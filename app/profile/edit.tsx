import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useAuthStore } from '../../src/store/authStore';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';

// STATUS: REAL — verified directly against UNILINK-BACKEND. Real
// routes are PUT /api/profile/me (name/bio/phone) and
// PUT /api/profile/me/avatar, PUT /api/profile/me/cover (image
// uploads) — NOT /api/users/profile/*, which this file called before
// the backend repo was available to check against. There is no
// /api/users mount anywhere in this backend; /api/profile was already
// mounted for the portfolio/achievements routes, and these three were
// added to that same router rather than inventing a new one. Kept as
// PUT (not PATCH) to match what this file already sent, since the
// backend route was written to match mobile rather than the reverse.
//
// The image upload mechanics (permission request, ImagePicker,
// multipart FormData via a raw axios.put, not the shared api client,
// manual Bearer token attachment) are copied directly from
// (tabs)/community.tsx's post-media upload, which is real, tested,
// and confirmed working on-device.

const AVATAR_UPLOAD_TIMEOUT_MS = 60000;

export default function EditProfileScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [admissionNumber, setAdmissionNumber] = useState(user?.admissionNumber ?? '');
  // Locked once the account already has a value — matches the
  // backend's own one-time-set enforcement in updateMyProfile;
  // this is a UX convenience only, not the actual security
  // boundary (the server ignores this field entirely once set,
  // even if called directly).
  const admissionNumberLocked = !!user?.admissionNumber;
  const [avatarUri, setAvatarUri] = useState(user?.avatarUrl ?? null);
  const [coverUri, setCoverUri] = useState(user?.coverUrl ?? null);
  const [pendingAvatarUpload, setPendingAvatarUpload] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pendingCoverUpload, setPendingCoverUpload] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { paddingBottom: Spacing.xl },
        title: { fontSize: 24, fontWeight: '800', color: colors.text, paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
        subtitle: { fontSize: 13, color: colors.textMuted, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
        coverWrap: { width: '100%', height: 140, backgroundColor: colors.surface },
        coverImage: { width: '100%', height: '100%' },
        coverEditButton: {
          position: 'absolute',
          bottom: Spacing.sm,
          right: Spacing.sm,
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderRadius: Radius.sm,
          paddingHorizontal: Spacing.sm,
          paddingVertical: 6,
        },
        coverEditText: { color: '#fff', fontSize: 12, fontWeight: '700' },
        avatarRow: { alignItems: 'center', marginTop: -40 },
        avatarWrap: { position: 'relative' },
        avatar: {
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 3,
          borderColor: colors.background,
        },
        avatarImage: { width: '100%', height: '100%', borderRadius: 44 },
        avatarInitial: { fontSize: 32, color: colors.white, fontWeight: '800' },
        avatarEditBadge: {
          position: 'absolute',
          bottom: 0,
          right: 0,
          backgroundColor: colors.primary,
          borderRadius: Radius.full,
          width: 28,
          height: 28,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: colors.background,
        },
        avatarEditIcon: { fontSize: 13 },
        form: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
        label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: Spacing.xs },
        input: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: 14,
          fontSize: 15,
          color: colors.text,
          marginBottom: Spacing.md,
        },
        bioInput: { minHeight: 100, textAlignVertical: 'top' },
        inputLocked: { opacity: 0.6 },
        error: { color: colors.danger, fontSize: 13, marginBottom: Spacing.md },
        success: { color: colors.secondary, fontSize: 13, marginBottom: Spacing.md },
        button: {
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          paddingVertical: 16,
          alignItems: 'center',
        },
        buttonDisabled: { opacity: 0.6 },
        buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
        cancelButton: { alignItems: 'center', marginTop: Spacing.md },
        cancelText: { color: colors.textMuted, fontSize: 14 },
      }),
    [colors]
  );

  const pickImage = async (aspect: [number, number]): Promise<ImagePicker.ImagePickerAsset | null> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Permission to access your photos is required.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return null;
    return result.assets[0];
  };

  const handlePickAvatar = async () => {
    const asset = await pickImage([1, 1]);
    if (!asset) return;
    setAvatarUri(asset.uri);
    setPendingAvatarUpload(asset);
  };

  const handlePickCover = async () => {
    const asset = await pickImage([16, 7]);
    if (!asset) return;
    setCoverUri(asset.uri);
    setPendingCoverUpload(asset);
  };

  // Shared multipart upload helper — identical mechanics to
  // community.tsx's proven pattern, parameterized by endpoint and
  // field name rather than duplicated twice for avatar vs. cover.
  const uploadImage = async (endpoint: string, fieldName: string, asset: ImagePicker.ImagePickerAsset) => {
    const token = await SecureStore.getItemAsync('unilink_token');
    const formData = new FormData();
    formData.append(fieldName, {
      uri: asset.uri,
      name: asset.fileName || `${fieldName}-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    } as any);

    const res = await axios.put(`${api.defaults.baseURL}${endpoint}`, formData, {
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
        'Content-Type': 'multipart/form-data',
      },
      timeout: AVATAR_UPLOAD_TIMEOUT_MS,
    });
    return res.data?.data?.url as string | undefined;
  };

  const handleSubmit = async () => {
    setError('');
    setSuccessMessage('');
    setLoading(true);
    try {
      // Images upload separately from the text fields, matching the
      // proposed shape of three distinct endpoints rather than one
      // giant multipart body — this also means a failed avatar upload
      // doesn't block name/bio from saving, and vice versa.
      let newAvatarUrl: string | undefined;
      let newCoverUrl: string | undefined;

      if (pendingAvatarUpload) {
        newAvatarUrl = await uploadImage('/profile/me/avatar', 'avatar', pendingAvatarUpload);
      }
      if (pendingCoverUpload) {
        newCoverUrl = await uploadImage('/profile/me/cover', 'cover', pendingCoverUpload);
      }

      await api.put('/profile/me', {
        name,
        bio,
        phone,
        ...(admissionNumberLocked ? {} : { admissionNumber }),
      });

      setUser({
        ...(user as any),
        name,
        bio,
        phone,
        avatarUrl: newAvatarUrl ?? user?.avatarUrl,
        coverUrl: newCoverUrl ?? user?.coverUrl,
        admissionNumber: admissionNumberLocked ? user?.admissionNumber : admissionNumber,
      });

      setPendingAvatarUpload(null);
      setPendingCoverUpload(null);
      setSuccessMessage('Profile updated.');
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          'Could not update profile. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.coverWrap}
          onPress={handlePickCover}
          accessibilityRole="button"
          accessibilityLabel="Change cover photo"
        >
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" />
          ) : null}
          <View style={styles.coverEditButton}>
            <Text style={styles.coverEditText}>{coverUri ? 'Change cover' : 'Add cover photo'}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.avatarRow}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={handlePickAvatar}
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
          >
            <View style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>{name?.charAt(0)?.toUpperCase() || '?'}</Text>
              )}
            </View>
            <View style={styles.avatarEditBadge} accessibilityElementsHidden importantForAccessibility="no">
              <Text style={styles.avatarEditIcon}>✏️</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Edit Profile</Text>
        <Text style={styles.subtitle}>Update your photo, name, phone, and bio.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            editable={!loading}
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            placeholderTextColor={colors.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!loading}
          />

          <Text style={styles.label}>
            Admission Number{admissionNumberLocked ? '' : ' (can only be set once)'}
          </Text>
          <TextInput
            style={[styles.input, admissionNumberLocked && styles.inputLocked]}
            placeholder="e.g. CIT/2024/001234"
            placeholderTextColor={colors.textMuted}
            value={admissionNumber}
            onChangeText={setAdmissionNumber}
            editable={!loading && !admissionNumberLocked}
            autoCapitalize="characters"
            accessibilityLabel="Admission number"
            accessibilityHint={admissionNumberLocked ? 'This value cannot be changed once set' : undefined}
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            placeholder="Bio"
            placeholderTextColor={colors.textMuted}
            value={bio}
            onChangeText={setBio}
            multiline
            editable={!loading}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Save profile"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Save Profile</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
