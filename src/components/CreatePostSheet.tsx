import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useColors, Radius, Spacing } from '../constants/theme';

// STATUS: REAL — the "+" post creator. Tapping + offers Text, Photo or Video; a post can
// be any mix, up to 4 attachments, and needs only SOMETHING (no title is required).
//
// Built to not lose people's work:
//   - an unsent draft survives closing the sheet and re-opening it
//   - a failed upload keeps the text and the chosen media, with a plain-language reason
//   - the Post button is disabled while uploading, so a double tap can't post twice
//
// Limits mirror the server so nobody uploads for a minute and is then rejected:
// 4 attachments, 1 video, 50 MB per file, 5000 characters.

const MAX_MEDIA_ITEMS = 4;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TEXT = 5000;
const UPLOAD_TIMEOUT_MS = 120000;

interface PendingAsset {
  uri: string;
  type: 'image' | 'video';
  fileName: string;
  mimeType: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onPosted: () => void;
}

export function CreatePostSheet({ visible, onClose, onPosted }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'choose' | 'compose'>('choose');
  const [text, setText] = useState('');
  const [assets, setAssets] = useState<PendingAsset[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDraft = text.trim().length > 0 || assets.length > 0;
  const hasVideo = assets.some((a) => a.type === 'video');
  const canPost = hasDraft && !isPosting;

  // Opening the sheet: an unsent draft goes straight back to composing.
  useEffect(() => {
    if (visible) {
      setError(null);
      setStep(hasDraft ? 'compose' : 'choose');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
        sheet: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.md,
          maxHeight: '88%',
        },
        grabber: {
          alignSelf: 'center',
          width: 44,
          height: 5,
          borderRadius: 3,
          backgroundColor: colors.border,
          marginBottom: Spacing.md,
        },
        headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
        title: { fontSize: 20, fontWeight: '800', color: colors.text },
        closeText: { fontSize: 22, color: colors.textMuted, paddingHorizontal: Spacing.sm },
        optionsRow: { flexDirection: 'row', gap: Spacing.sm },
        option: {
          flex: 1,
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingVertical: Spacing.lg,
          paddingHorizontal: Spacing.xs,
        },
        optionIcon: { fontSize: 30 },
        optionLabel: { marginTop: Spacing.xs, fontSize: 15, fontWeight: '700', color: colors.text },
        optionHint: { marginTop: 2, fontSize: 11, color: colors.textMuted, textAlign: 'center' },
        input: {
          minHeight: 110,
          maxHeight: 220,
          fontSize: 16,
          color: colors.text,
          textAlignVertical: 'top',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
        },
        counter: { alignSelf: 'flex-end', marginTop: 4, fontSize: 11, color: colors.textMuted },
        previewRow: { marginTop: Spacing.sm },
        thumbWrap: { marginRight: Spacing.sm, position: 'relative' },
        thumb: { width: 84, height: 84, borderRadius: Radius.sm, backgroundColor: colors.border },
        videoThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        videoGlyph: { fontSize: 26, color: colors.textMuted },
        videoLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
        removeButton: {
          position: 'absolute',
          top: -6,
          right: -6,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: colors.danger,
          alignItems: 'center',
          justifyContent: 'center',
        },
        removeText: { color: colors.white, fontSize: 12, fontWeight: '800' },
        addRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
        addButton: {
          flex: 1,
          alignItems: 'center',
          paddingVertical: 11,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.primary,
        },
        addButtonText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
        disabled: { opacity: 0.4 },
        error: { color: colors.danger, fontSize: 13, marginTop: Spacing.sm, lineHeight: 18 },
        postButton: {
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          paddingVertical: 15,
          alignItems: 'center',
          marginTop: Spacing.md,
        },
        postButtonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
        discard: { alignItems: 'center', paddingVertical: Spacing.md },
        discardText: { color: colors.textMuted, fontSize: 13 },
        uploadingNote: { marginTop: Spacing.sm, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
      }),
    [colors]
  );

  const handleClose = () => {
    if (isPosting) return; // never abandon an upload halfway
    onClose();
  };

  const pickMedia = async (kind: 'image' | 'video') => {
    setError(null);
    const remaining = MAX_MEDIA_ITEMS - assets.length;
    if (remaining <= 0) {
      setError(`You can attach up to ${MAX_MEDIA_ITEMS} items per post.`);
      return;
    }
    if (kind === 'video' && hasVideo) {
      setError('You can attach one video per post.');
      return;
    }
    try {
      // The system picker needs no storage permission, so there is no permission prompt
      // to get denied and dead-end the user.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === 'video' ? ['videos'] : ['images'],
        allowsMultipleSelection: kind === 'image',
        selectionLimit: kind === 'image' ? remaining : 1,
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.length) return;

      const accepted: PendingAsset[] = [];
      let skippedLarge = false;
      for (const asset of result.assets) {
        if (asset.fileSize && asset.fileSize > MAX_FILE_BYTES) {
          skippedLarge = true;
          continue;
        }
        const isVideo = asset.type === 'video';
        accepted.push({
          uri: asset.uri,
          type: isVideo ? 'video' : 'image',
          fileName: asset.fileName || `upload-${Date.now()}-${accepted.length}.${isVideo ? 'mp4' : 'jpg'}`,
          mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        });
      }
      if (skippedLarge) setError('A file larger than 50 MB was skipped. Pick a smaller one.');
      if (accepted.length > 0) {
        setAssets((prev) => [...prev, ...accepted].slice(0, MAX_MEDIA_ITEMS));
        setStep('compose');
      }
    } catch {
      setError('Could not open your gallery. Please try again.');
    }
  };

  const removeAsset = (index: number) => setAssets((prev) => prev.filter((_, i) => i !== index));

  const discard = () => {
    setText('');
    setAssets([]);
    setError(null);
    setStep('choose');
  };

  const submit = async () => {
    if (isPosting) return;
    const content = text.trim();
    if (!content && assets.length === 0) {
      setError('Add some text, a photo or a video first.');
      return;
    }
    setIsPosting(true);
    setError(null);
    try {
      if (assets.length === 0) {
        await api.post('/posts/create', { content });
      } else {
        const token = await SecureStore.getItemAsync('unilink_token');
        const formData = new FormData();
        if (content) formData.append('content', content);
        assets.forEach((asset) => {
          formData.append('media', { uri: asset.uri, name: asset.fileName, type: asset.mimeType } as any);
        });
        await axios.post(`${api.defaults.baseURL}/posts/create`, formData, {
          headers: {
            Authorization: token ? `Bearer ${token}` : undefined,
            'Content-Type': 'multipart/form-data',
          },
          timeout: UPLOAD_TIMEOUT_MS,
        });
      }
      setText('');
      setAssets([]);
      setStep('choose');
      onPosted();
      onClose();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) setError('Your session expired. Please log in again.');
      else if (err?.code === 'ECONNABORTED') setError('The upload took too long. Check your connection and try again. Your post is still here.');
      else if (!err?.response) setError('No connection. Your post is still here; try again when you are back online.');
      else setError(err.response.data?.message || 'Could not create the post. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel="Close" accessibilityRole="button" />

        <View style={[styles.sheet, { paddingBottom: Spacing.lg + insets.bottom }]}>
          <View style={styles.grabber} />

          {step === 'choose' ? (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.title} accessibilityRole="header">Create post</Text>
                <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close">
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.optionsRow}>
                <TouchableOpacity style={styles.option} onPress={() => setStep('compose')} accessibilityRole="button" accessibilityLabel="Write a text post">
                  <Text style={styles.optionIcon}>✏️</Text>
                  <Text style={styles.optionLabel}>Text</Text>
                  <Text style={styles.optionHint}>Share a thought</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.option} onPress={() => pickMedia('image')} accessibilityRole="button" accessibilityLabel="Add photos">
                  <Text style={styles.optionIcon}>🖼️</Text>
                  <Text style={styles.optionLabel}>Photo</Text>
                  <Text style={styles.optionHint}>Up to {MAX_MEDIA_ITEMS}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.option} onPress={() => pickMedia('video')} accessibilityRole="button" accessibilityLabel="Add a video">
                  <Text style={styles.optionIcon}>🎬</Text>
                  <Text style={styles.optionLabel}>Video</Text>
                  <Text style={styles.optionHint}>One, up to 50 MB</Text>
                </TouchableOpacity>
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.headerRow}>
                <Text style={styles.title} accessibilityRole="header">New post</Text>
                <TouchableOpacity onPress={handleClose} disabled={isPosting} accessibilityRole="button" accessibilityLabel="Close">
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="What's happening on campus?"
                placeholderTextColor={colors.textMuted}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={MAX_TEXT}
                editable={!isPosting}
                autoFocus={assets.length === 0}
                accessibilityLabel="Post text"
              />
              <Text style={styles.counter}>{text.length}/{MAX_TEXT}</Text>

              {assets.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewRow} keyboardShouldPersistTaps="handled">
                  {assets.map((asset, index) => (
                    <View key={`${asset.uri}-${index}`} style={styles.thumbWrap} accessibilityLabel={`Attachment ${index + 1}, ${asset.type}`}>
                      {asset.type === 'video' ? (
                        <View style={[styles.thumb, styles.videoThumb]}>
                          <Text style={styles.videoGlyph}>▶</Text>
                          <Text style={styles.videoLabel}>Video</Text>
                        </View>
                      ) : (
                        <Image source={{ uri: asset.uri }} style={styles.thumb} />
                      )}
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeAsset(index)}
                        disabled={isPosting}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove attachment ${index + 1}`}
                      >
                        <Text style={styles.removeText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={styles.addRow}>
                <TouchableOpacity
                  style={[styles.addButton, (isPosting || assets.length >= MAX_MEDIA_ITEMS) && styles.disabled]}
                  onPress={() => pickMedia('image')}
                  disabled={isPosting || assets.length >= MAX_MEDIA_ITEMS}
                  accessibilityRole="button"
                  accessibilityLabel="Add photos"
                >
                  <Text style={styles.addButtonText}>🖼️ Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addButton, (isPosting || hasVideo || assets.length >= MAX_MEDIA_ITEMS) && styles.disabled]}
                  onPress={() => pickMedia('video')}
                  disabled={isPosting || hasVideo || assets.length >= MAX_MEDIA_ITEMS}
                  accessibilityRole="button"
                  accessibilityLabel="Add a video"
                >
                  <Text style={styles.addButtonText}>🎬 Video</Text>
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.postButton, !canPost && styles.disabled]}
                onPress={submit}
                disabled={!canPost}
                accessibilityRole="button"
                accessibilityLabel="Post"
                accessibilityState={{ disabled: !canPost, busy: isPosting }}
              >
                {isPosting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.postButtonText}>Post</Text>}
              </TouchableOpacity>
              {isPosting && assets.length > 0 ? (
                <Text style={styles.uploadingNote}>Uploading. Photos and videos can take a minute on a slow connection.</Text>
              ) : null}

              {hasDraft && !isPosting ? (
                <TouchableOpacity style={styles.discard} onPress={discard} accessibilityRole="button" accessibilityLabel="Discard draft">
                  <Text style={styles.discardText}>Discard draft</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
