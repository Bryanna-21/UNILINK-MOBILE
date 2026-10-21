import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing, useColors } from '../constants/theme';

// STATUS: REAL. A document in a post is shown OPEN: page 1 is visible straight away and a swipe
// to the left shows page 2, and so on. Nothing is downloaded or opened in another app.
//
// How: when a document is posted, the backend already renders every page to an image
// (PDF, and Word via LibreOffice) and stores them on the post as media.pages. This component only
// shows those images. Tap a page to read it full screen. "Open original" is still there for anyone
// who wants the actual file.
//
// Falls back to the old "Open document" card when there are no page images: a document posted before
// pages were rendered, or one whose rendering failed. While the backend is still preparing the pages
// it says so.

export interface DocumentMedia {
  url: string;
  originalName?: string | null;
  pageCount?: number;
  processingStatus?: 'pending' | 'ready' | 'failed';
  pages?: { page: number; url: string }[];
}

const MAX_INLINE_HEIGHT = 460;
const DEFAULT_RATIO = 1.35; // height / width of a typical portrait page, until the first page tells us

export default function DocumentViewer({ media }: { media: DocumentMedia }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullIndex, setFullIndex] = useState(0);

  const pages = useMemo(() => [...(media.pages ?? [])].sort((a, b) => a.page - b.page), [media.pages]);
  const name = media.originalName || 'Document';
  const openOriginal = () => Linking.openURL(media.url);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          height: 180,
          borderRadius: Radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: Spacing.lg,
        },
        cardTitle: { marginTop: Spacing.sm, fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center' },
        cardHint: { marginTop: 4, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
        pager: { borderRadius: Radius.sm, overflow: 'hidden', backgroundColor: '#E9EAEE', borderWidth: 1, borderColor: colors.border },
        badge: {
          position: 'absolute',
          top: Spacing.sm,
          right: Spacing.sm,
          backgroundColor: 'rgba(0,0,0,0.6)',
          paddingHorizontal: Spacing.sm,
          paddingVertical: 3,
          borderRadius: Radius.sm,
        },
        badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
        caption: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
        captionName: { flex: 1, color: colors.textMuted, fontSize: 12 },
        captionLink: { color: colors.primary, fontSize: 12, fontWeight: '700' },
        fullRoot: { flex: 1, backgroundColor: '#000000' },
        fullBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
        fullClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        fullCloseText: { color: '#FFFFFF', fontSize: 22 },
        fullTitle: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
        fullCount: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
        fullFooter: { alignItems: 'center', paddingTop: Spacing.sm },
        fullOpen: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textDecorationLine: 'underline', padding: Spacing.sm },
      }),
    [colors]
  );

  // The backend is still turning the file into pages (it does this just after posting).
  if (media.processingStatus === 'pending' && pages.length === 0) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.cardTitle}>Preparing pages…</Text>
        <Text style={styles.cardHint}>This takes a moment. Pull down to refresh.</Text>
      </View>
    );
  }

  // No page images (an older post, or rendering failed): the original behaviour.
  if (pages.length === 0) {
    return (
      <TouchableOpacity style={styles.card} onPress={openOriginal} accessibilityRole="button" accessibilityLabel={`Open ${name}`}>
        <Text style={{ fontSize: 46 }}>📄</Text>
        <Text style={styles.cardTitle} numberOfLines={2}>{name}</Text>
        <Text style={styles.cardHint}>Tap to open</Text>
      </TouchableOpacity>
    );
  }

  const height = Math.min(Math.round(width * ratio), MAX_INLINE_HEIGHT);

  const onScrollEnd = (x: number) => {
    const i = Math.max(0, Math.min(pages.length - 1, Math.round(x / Math.max(1, width))));
    setIndex(i);
    const next = pages[i + 1];
    if (next) Image.prefetch(next.url).catch(() => {});
  };

  const fullHeight = window.height - insets.top - insets.bottom - 110;

  return (
    <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
      {width > 0 && (
        <>
          <View style={styles.pager}>
            <FlatList
              horizontal
              pagingEnabled
              data={pages}
              keyExtractor={(p) => String(p.page)}
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              initialNumToRender={1}
              maxToRenderPerBatch={1}
              windowSize={3}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              onMomentumScrollEnd={(e) => onScrollEnd(e.nativeEvent.contentOffset.x)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.92}
                  style={{ width, height }}
                  onPress={() => { setFullIndex(index); setFullscreen(true); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Page ${item.page} of ${pages.length}. Tap to read full screen`}
                >
                  <Image
                    source={{ uri: item.url }}
                    style={{ width, height }}
                    resizeMode="contain"
                    onLoad={(e) => {
                      // The first page tells us the page shape, so the box fits it instead of guessing.
                      const s = e.nativeEvent?.source;
                      if (item.page === pages[0].page && s?.width && s?.height) setRatio(s.height / s.width);
                    }}
                  />
                </TouchableOpacity>
              )}
            />
            <View style={styles.badge} pointerEvents="none">
              <Text style={styles.badgeText}>{index + 1} / {pages.length}</Text>
            </View>
          </View>
          <View style={styles.caption}>
            <Text style={styles.captionName} numberOfLines={1}>{name}{pages.length > 1 ? ' · swipe for more pages' : ''}</Text>
            <TouchableOpacity onPress={openOriginal} accessibilityRole="button" accessibilityLabel="Open the original file">
              <Text style={styles.captionLink}>Open original</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)} statusBarTranslucent>
        <View style={[styles.fullRoot, { paddingTop: insets.top }]}>
          <View style={styles.fullBar}>
            <TouchableOpacity style={styles.fullClose} onPress={() => setFullscreen(false)} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.fullCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.fullTitle} numberOfLines={1}>{name}</Text>
            <Text style={styles.fullCount}>{fullIndex + 1} / {pages.length}</Text>
          </View>
          <FlatList
            horizontal
            pagingEnabled
            data={pages}
            keyExtractor={(p) => String(p.page)}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(fullIndex, pages.length - 1)}
            getItemLayout={(_, i) => ({ length: window.width, offset: window.width * i, index: i })}
            initialNumToRender={1}
            windowSize={3}
            onMomentumScrollEnd={(e) => setFullIndex(Math.round(e.nativeEvent.contentOffset.x / window.width))}
            renderItem={({ item }) => (
              // Pinch to zoom works on iOS; on Android the page is shown to fit the screen.
              <ScrollView
                style={{ width: window.width, height: fullHeight }}
                contentContainerStyle={{ width: window.width, height: fullHeight, alignItems: 'center', justifyContent: 'center' }}
                maximumZoomScale={3}
                minimumZoomScale={1}
                bouncesZoom
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
              >
                <Image source={{ uri: item.url }} style={{ width: window.width, height: fullHeight }} resizeMode="contain" />
              </ScrollView>
            )}
          />
          <View style={[styles.fullFooter, { paddingBottom: insets.bottom + Spacing.sm }]}>
            <TouchableOpacity onPress={openOriginal} accessibilityRole="button">
              <Text style={styles.fullOpen}>Open the original file</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
