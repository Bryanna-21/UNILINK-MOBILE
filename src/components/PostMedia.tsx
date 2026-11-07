import { Image, StyleSheet, View } from 'react-native';
import { FeedVideo } from './SafeVideo';
import DocumentViewer from './DocumentViewer';
import { useColors, Radius, Spacing } from '../constants/theme';

// All of a post's attachments, one under the other, for the screen that shows a single post: a
// photo, a video (tap to play), or a document (its pages swipe, with arrows). The Campus feed has
// its own compact strip; this one is for reading a post in full.
export type DetailMedia = {
  url: string;
  type: 'image' | 'video' | 'document';
  publicId?: string;
  [key: string]: unknown;
};

export default function PostMedia({ media }: { media: DetailMedia[] }) {
  const colors = useColors();
  if (!Array.isArray(media) || media.length === 0) return null;

  return (
    <View style={styles.stack}>
      {media.map((m, i) => {
        const key = `${m.publicId ?? m.url}-${i}`;
        if (m.type === 'video') {
          return (
            <View key={key} style={styles.item}>
              <FeedVideo uri={m.url} height={240} />
            </View>
          );
        }
        if (m.type === 'document') {
          return (
            <View key={key} style={styles.item}>
              <DocumentViewer media={m as any} />
            </View>
          );
        }
        return (
          <Image
            key={key}
            source={{ uri: m.url }}
            style={[styles.image, { backgroundColor: colors.border }]}
            resizeMode="contain"
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.sm, marginTop: Spacing.sm },
  item: { width: '100%' },
  image: { width: '100%', height: 280, borderRadius: Radius.sm },
});
