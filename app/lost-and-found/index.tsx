import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { LoadingSkeletonList } from '../../src/components/LoadingSkeleton';

// STATUS: REAL — GET/POST /api/lost-and-found and PATCH
// /api/lost-and-found/:id/resolve all call the live backend. Image
// upload mechanics (permission, ImagePicker, multipart FormData via
// raw axios, manual Bearer token) copied directly from
// profile/edit.tsx's avatar upload, itself copied from
// (tabs)/community.tsx's post-media upload - real, tested, confirmed
// working on-device.
//
// One real backend behavior to know, not a mobile limitation: GET
// only ever returns unresolved items (resolved: false is hardcoded
// into the backend query) - there is no way to fetch resolved items
// through this endpoint at all. Resolving an item makes it disappear
// from this list permanently, with no "resolved" history view
// possible without a new backend route. Not worked around here since
// that would mean guessing at a feature the backend doesn't support.

const UPLOAD_TIMEOUT_MS = 60000;

type ItemStatus = 'lost' | 'found';

interface LostItem {
  _id: string;
  itemName: string;
  description?: string;
  location?: string;
  status: ItemStatus;
  imageUrl?: string;
  contactInfo?: string;
  reportedBy: string;
  resolved: boolean;
  createdAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function LostAndFoundScreen() {
  const colors = useColors();
  const styles = useLostAndFoundStyles(colors);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [items, setItems] = useState<LostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ItemStatus>('all');

  const [formVisible, setFormVisible] = useState(false);
  const [formStatus, setFormStatus] = useState<ItemStatus>('lost');
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/lost-and-found');
      setItems(res.data?.data ?? []);
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Could not load lost & found items.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredItems = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.status === filter)),
    [items, filter]
  );

  const resetForm = () => {
    setFormStatus('lost');
    setItemName('');
    setDescription('');
    setLocation('');
    setContactInfo('');
    setImageAsset(null);
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Permission to access your photos is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    setImageAsset(result.assets[0]);
  };

  const handleSubmit = async () => {
    if (!itemName.trim()) {
      Alert.alert('Item name required', 'Please describe the item.');
      return;
    }
    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('unilink_token');
      const formData = new FormData();
      formData.append('itemName', itemName.trim());
      formData.append('status', formStatus);
      if (description.trim()) formData.append('description', description.trim());
      if (location.trim()) formData.append('location', location.trim());
      if (contactInfo.trim()) formData.append('contactInfo', contactInfo.trim());
      if (imageAsset) {
        formData.append('image', {
          uri: imageAsset.uri,
          name: imageAsset.fileName || `lost-item-${Date.now()}.jpg`,
          type: imageAsset.mimeType || 'image/jpeg',
        } as any);
      }

      await axios.post(`${api.defaults.baseURL}/lost-and-found`, formData, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
          'Content-Type': 'multipart/form-data',
        },
        timeout: UPLOAD_TIMEOUT_MS,
      });

      setFormVisible(false);
      resetForm();
      load();
    } catch (err: any) {
      Alert.alert('Could not submit', err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = (item: LostItem) => {
    Alert.alert('Mark as resolved?', `"${item.itemName}" will be removed from the list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        style: 'destructive',
        onPress: async () => {
          setResolvingId(item._id);
          try {
            await api.patch(`/lost-and-found/${item._id}/resolve`);
            setItems((prev) => prev.filter((i) => i._id !== item._id));
          } catch (err: any) {
            Alert.alert('Could not resolve', err?.response?.data?.message || 'Something went wrong.');
          } finally {
            setResolvingId(null);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: LostItem }) => {
    // reportedBy is a plain string userId on the backend (not
    // populated), so this is a direct string comparison - matches
    // exactly how markResolved authorizes server-side, no ObjectId
    // casting concerns since neither side ever treats it as one.
    const isOwner = !!currentUserId && item.reportedBy === currentUserId;

    return (
      <View style={styles.card}>
        {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />}
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.itemName}>{item.itemName}</Text>
            <View
              style={[
                styles.statusPill,
                { borderColor: item.status === 'lost' ? colors.danger : colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  { color: item.status === 'lost' ? colors.danger : colors.primary },
                ]}
              >
                {item.status === 'lost' ? 'Lost' : 'Found'}
              </Text>
            </View>
          </View>

          {!!item.description && <Text style={styles.meta}>{item.description}</Text>}
          {!!item.location && <Text style={styles.meta}>📍 {item.location}</Text>}
          {!!item.contactInfo && <Text style={styles.meta}>📞 {item.contactInfo}</Text>}
          <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>

          {isOwner && (
            <TouchableOpacity
              style={styles.resolveButton}
              onPress={() => handleResolve(item)}
              disabled={resolvingId === item._id}
              accessibilityRole="button"
              accessibilityLabel={`Mark ${item.itemName} as resolved`}
            >
              {resolvingId === item._id ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.resolveButtonText}>Mark as resolved</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <LoadingSkeletonList rows={5} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        contentContainerStyle={filteredItems.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          <>
            <Text style={styles.title} accessibilityRole="header">
              Lost & Found
            </Text>
            <StatusBanner
              status="real"
              note="Resolved items are removed from this list by the backend - there is no history view for them."
            />
            {loadError && <Text style={styles.errorText}>{loadError}</Text>}

            <View style={styles.filterRow} accessibilityRole="radiogroup">
              {(['all', 'lost', 'found'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterButton, filter === f && styles.filterButtonActive]}
                  onPress={() => setFilter(f)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: filter === f }}
                >
                  <Text style={[styles.filterButtonText, filter === f && styles.filterButtonTextActive]}>
                    {f === 'all' ? 'All' : f === 'lost' ? 'Lost' : 'Found'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        ListEmptyComponent={
          !loadError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No items reported yet.</Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setFormVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Report an item"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={formVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>Report an Item</Text>

              <View style={styles.typeRow} accessibilityRole="radiogroup">
                {(['lost', 'found'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.typeButton, formStatus === s && styles.typeButtonActive]}
                    onPress={() => setFormStatus(s)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: formStatus === s }}
                  >
                    <Text style={[styles.typeButtonText, formStatus === s && styles.typeButtonTextActive]}>
                      {s === 'lost' ? 'I lost something' : 'I found something'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Item name *"
                placeholderTextColor={colors.textMuted}
                value={itemName}
                onChangeText={setItemName}
              />
              <TextInput
                style={styles.input}
                placeholder="Description (optional)"
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
              />
              <TextInput
                style={styles.input}
                placeholder="Location (optional)"
                placeholderTextColor={colors.textMuted}
                value={location}
                onChangeText={setLocation}
              />
              <TextInput
                style={styles.input}
                placeholder="Contact info (optional)"
                placeholderTextColor={colors.textMuted}
                value={contactInfo}
                onChangeText={setContactInfo}
              />

              <TouchableOpacity style={styles.imagePickerButton} onPress={handlePickImage}>
                {imageAsset ? (
                  <Image source={{ uri: imageAsset.uri }} style={styles.imagePreview} />
                ) : (
                  <Text style={styles.imagePickerText}>Add a photo (optional)</Text>
                )}
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setFormVisible(false);
                    resetForm();
                  }}
                  disabled={submitting}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Theme-aware styles rebuilt on palette change — same pattern as
// every other real screen in this codebase. Do not switch this to a
// module-level StyleSheet.create with a static Colors import.
function useLostAndFoundStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
        listContent: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
        emptyContainer: { flexGrow: 1, padding: Spacing.md },
        title: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm },
        errorText: { color: colors.danger, fontSize: 13, marginBottom: Spacing.sm },
        filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
        filterButton: {
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        filterButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary },
        filterButtonText: { fontSize: 13, color: colors.text },
        filterButtonTextActive: { color: colors.white, fontWeight: '700' },
        card: {
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: Spacing.sm,
          overflow: 'hidden',
        },
        cardImage: { width: '100%', height: 160 },
        cardBody: { padding: Spacing.md },
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        itemName: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
        statusPill: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
        statusPillText: { fontSize: 11, fontWeight: '700' },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        resolveButton: {
          marginTop: Spacing.sm,
          alignSelf: 'flex-start',
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: Radius.sm,
          paddingHorizontal: Spacing.md,
          paddingVertical: 6,
        },
        resolveButtonText: { fontSize: 12, fontWeight: '700', color: colors.primary },
        emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
        emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
        fab: {
          position: 'absolute',
          right: Spacing.lg,
          bottom: Spacing.lg,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        },
        fabText: { fontSize: 28, color: colors.white, fontWeight: '700', lineHeight: 30 },
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        modalCard: {
          backgroundColor: colors.background,
          borderTopLeftRadius: Radius.lg,
          borderTopRightRadius: Radius.lg,
          padding: Spacing.lg,
          maxHeight: '85%',
        },
        modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: Spacing.md },
        typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
        typeButton: {
          flex: 1,
          paddingVertical: Spacing.sm,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
        },
        typeButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary },
        typeButtonText: { fontSize: 13, color: colors.text },
        typeButtonTextActive: { color: colors.white, fontWeight: '700' },
        input: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          fontSize: 14,
          color: colors.text,
          marginBottom: Spacing.sm,
        },
        imagePickerButton: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          borderStyle: 'dashed',
          padding: Spacing.md,
          alignItems: 'center',
          marginBottom: Spacing.md,
        },
        imagePickerText: { fontSize: 13, color: colors.textMuted },
        imagePreview: { width: '100%', height: 140, borderRadius: Radius.sm },
        modalActions: { flexDirection: 'row', gap: Spacing.sm },
        cancelButton: {
          flex: 1,
          paddingVertical: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
        },
        cancelButtonText: { fontSize: 14, fontWeight: '700', color: colors.text },
        submitButton: {
          flex: 1,
          paddingVertical: Spacing.md,
          borderRadius: Radius.md,
          backgroundColor: colors.primary,
          alignItems: 'center',
        },
        submitButtonDisabled: { opacity: 0.5 },
        submitButtonText: { fontSize: 14, fontWeight: '700', color: colors.white },
      }),
    [colors]
  );
}
