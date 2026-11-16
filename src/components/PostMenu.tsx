import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { api } from '../api/client';
import AudiencePicker from './AudiencePicker';
import { AudienceValue, audienceFields, audienceIsComplete, audienceOption } from '../utils/audience';
import { SavableMedia, savePostMedia } from '../utils/savePost';
import { useColors } from '../constants/theme';

// STATUS: REAL. The "⋯" menu on a post.
//   Everyone (when showSave): Save the post's photos, videos and documents to the phone.
//   The author:               Change who can see it (PATCH /posts/:id/audience) and Delete it (DELETE /posts/:id).
// With nothing to offer it draws nothing. Deleting takes the post's comments, likes and reshares with it, and
// narrowing the audience can remove reshares that would keep showing it to people it no longer includes. Both
// say so before they happen.

export interface MenuPost {
  _id: string;
  userId: string;
  audience?: string;
  authorName?: string;
  media?: SavableMedia[];
}

interface Props {
  post: MenuPost;
  isOwner: boolean;
  showSave?: boolean;
  color?: string;
  onDeleted?: () => void;
  onAudienceChanged?: (audience: string) => void;
}

export default function PostMenu({ post, isOwner, showSave = false, color, onDeleted, onAudienceChanged }: Props) {
  const colors = useColors();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [value, setValue] = useState<AudienceValue>({ kind: (post.audience as any) || 'university', universities: [], people: [] });
  const [busy, setBusy] = useState(false);

  const hasMedia = !!post.media && post.media.length > 0;
  const canSave = showSave && hasMedia;
  if (!isOwner && !canSave) return null;

  const doDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/posts/${post._id}`);
      onDeleted?.();
    } catch (err: any) {
      Alert.alert('Could not delete', err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete this post?', 'Its comments and likes are deleted too, and so are any reshares of it. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);

  const saveFiles = async () => {
    setBusy(true);
    try {
      const result = await savePostMedia(post.authorName, post.media ?? []);
      if (result.saved === 0) Alert.alert('Could not save', 'The files could not be downloaded. Check your connection and try again.');
      else if (result.failed > 0) Alert.alert('Saved with a problem', `${result.failed} of ${result.saved + result.failed} files could not be downloaded.`);
    } finally {
      setBusy(false);
    }
  };

  // The picker closes with Done. If the choice is complete and different, it is saved then.
  const closePicker = async () => {
    setPickerOpen(false);
    const changed = value.kind !== (post.audience || 'university') || value.kind === 'universities' || value.kind === 'people';
    if (!changed || !audienceIsComplete(value)) return;
    setBusy(true);
    try {
      const res = await api.patch(`/posts/${post._id}/audience`, audienceFields(value));
      onAudienceChanged?.(value.kind);
      const removed = res.data?.removedReshares ?? 0;
      Alert.alert(
        'Updated',
        `This post is now for: ${audienceOption(value.kind).label}.` + (removed > 0 ? ` ${removed} reshare${removed === 1 ? ' was' : 's were'} removed because they would have shown it to people outside this audience.` : '')
      );
    } catch (err: any) {
      Alert.alert('Could not change who can see this', err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const open = () => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (canSave) buttons.push({ text: 'Save files to phone', onPress: saveFiles });
    if (isOwner) {
      buttons.push({ text: 'Who can see this', onPress: () => setPickerOpen(true) });
      buttons.push({ text: 'Delete post', style: 'destructive', onPress: confirmDelete });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Post options', undefined, buttons);
  };

  return (
    <>
      <TouchableOpacity onPress={open} disabled={busy} hitSlop={10} accessibilityRole="button" accessibilityLabel="Post options" style={styles.button}>
        <Text style={[styles.dots, { color: busy ? colors.textMuted : color || colors.text }]}>{busy ? '…' : '⋯'}</Text>
      </TouchableOpacity>
      {isOwner ? <AudiencePicker visible={pickerOpen} value={value} onChange={setValue} onClose={closePicker} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 8, paddingVertical: 2 },
  dots: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
});
