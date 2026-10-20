import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Modal, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import KeyboardSafe from '../../src/components/KeyboardSafe';

// STATUS: REAL — GET/POST /api/community/announcements call the live
// backend. Without a courseId filter, GET returns every announcement
// globally (not just this lecturer's) — this screen lets the
// lecturer pick a course to scope both the list and new posts to.

interface Course {
  _id: string;
  title: string;
  code: string;
}

interface Announcement {
  _id: string;
  title: string;
  body: string;
  courseId?: string;
  postedBy: string;
  createdAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function LecturerAnnouncementsScreen() {
  const colors = useColors();
  const styles = useStyles(colors);

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    api
      .get('/courses')
      .then((res) => {
        const list: Course[] = res.data?.data ?? [];
        setCourses(list);
        if (list.length && !selectedCourseId) setSelectedCourseId(list[0]._id);
      })
      .catch(() => setCourses([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!selectedCourseId) {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      try {
        const res = await api.get('/community/announcements', { params: { courseId: selectedCourseId } });
        setAnnouncements(res.data?.data ?? []);
      } catch (err: any) {
        setLoadError(err?.response?.data?.message || 'Could not load announcements.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedCourseId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handlePost = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Title and body required', 'Please fill in both fields.');
      return;
    }
    setPosting(true);
    try {
      await api.post('/community/announcements', { title: title.trim(), body: body.trim(), courseId: selectedCourseId });
      setFormVisible(false);
      setTitle('');
      setBody('');
      load();
    } catch (err: any) {
      Alert.alert('Could not post', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setPosting(false);
    }
  };

  const renderItem = ({ item }: { item: Announcement }) => (
    <View style={styles.card}>
      <Text style={styles.announcementTitle}>{item.title}</Text>
      <Text style={styles.announcementBody}>{item.body}</Text>
      <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={announcements}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        contentContainerStyle={announcements.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          <>
            <Text style={styles.title} accessibilityRole="header">
              Announcements
            </Text>
            <StatusBanner status="real" note="Posts to the live backend and notifies enrolled students." />
            {loadError && <Text style={styles.errorText}>{loadError}</Text>}

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={courses}
              keyExtractor={(c) => c._id}
              style={styles.courseRow}
              renderItem={({ item: c }) => (
                <TouchableOpacity
                  style={[styles.courseChip, selectedCourseId === c._id && styles.courseChipActive]}
                  onPress={() => setSelectedCourseId(c._id)}
                >
                  <Text style={[styles.courseChipText, selectedCourseId === c._id && styles.courseChipTextActive]}>{c.code}</Text>
                </TouchableOpacity>
              )}
            />

            {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.md }} />}
          </>
        }
        ListEmptyComponent={
          !loading && !loadError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No announcements for this course yet.</Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setFormVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Post an announcement"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={formVisible} animationType="slide" transparent>
<KeyboardSafe>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Announcement</Text>
            <TextInput style={styles.input} placeholder="Title" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Message"
              placeholderTextColor={colors.textMuted}
              value={body}
              onChangeText={setBody}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setFormVisible(false)} disabled={posting}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.postButton, posting && styles.postButtonDisabled]} onPress={handlePost} disabled={posting}>
                {posting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.postButtonText}>Post</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardSafe>
</Modal>
    </View>
  );
}

function useStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        listContent: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
        emptyContainer: { flexGrow: 1, padding: Spacing.md },
        title: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm },
        errorText: { color: colors.danger, fontSize: 13, marginBottom: Spacing.sm },
        courseRow: { marginBottom: Spacing.sm },
        courseChip: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          marginRight: Spacing.sm,
        },
        courseChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
        courseChipText: { fontSize: 13, color: colors.text },
        courseChipTextActive: { color: colors.white, fontWeight: '700' },
        card: {
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
          marginBottom: Spacing.sm,
        },
        announcementTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
        announcementBody: { fontSize: 13, color: colors.text, marginTop: 4 },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: Spacing.xs },
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
        },
        modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: Spacing.md },
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
        multiline: { minHeight: 100, textAlignVertical: 'top' },
        modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
        cancelButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
        cancelButtonText: { fontSize: 14, fontWeight: '700', color: colors.text },
        postButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: colors.primary, alignItems: 'center' },
        postButtonDisabled: { opacity: 0.5 },
        postButtonText: { fontSize: 14, fontWeight: '700', color: colors.white },
      }),
    [colors]
  );
}
