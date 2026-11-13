import { useEffect, useMemo, useRef, useState } from 'react';
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
import { api } from '../api/client';
import { Radius, Spacing, useColors } from '../constants/theme';

// STATUS: REAL. A document in a post is shown OPEN: page 1 is visible straight away and a swipe
// to the left shows page 2, and so on. Nothing is downloaded or opened in another app.
//
// How: when a document is posted, the backend already renders every page to an image
// (PDF, and Word via LibreOffice) and stores them on the post as media.pages. This component only
// shows those images. Tap a page to read it full screen. "Open original" is still there for anyone
// who wants the actual file.
//
// Next to the swipe there are Previous / Next arrows, so turning the page never depends on a gesture
// alone (a vertical list can swallow a sideways swipe on some phones).
//
// Pages are drawn on the server a few at a time, page 1 and 2 first. While a document is still being prepared
// this component asks the server again every few seconds (when it knows the post id) and the pages appear by
// themselves: nobody has to pull down to refresh. A long document is drawn up to 100 pages.
//
// When there are no page images the card says why and opens the original on tap, in the same card
// every time: still being prepared, preparing failed, or an older post whose pages are not made yet.

export interface DocumentMedia {
  url: string;
  originalName?: string | null;
  pageCount?: number;
  totalPages?: number;
  processingStatus?: 'pending' | 'ready' | 'failed';
  pages?: { page: number; url: string }[];
}

const POLL_EVERY_MS = 4000;
const POLL_FOR_MS = 4 * 60 * 1000; // after this the card stops asking; opening the post again starts over
const MAX_INLINE_HEIGHT = 460;
const DEFAULT_RATIO = 1.35; // height / width of a typical portrait page, until the first page tells us

export default function DocumentViewer({ media: given, postId }: { media: DocumentMedia; postId?: string }) {
  const colors = useColors();
  const listRef = useRef<FlatList<{ page: number; url: string }>>(null);
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullIndex, setFullIndex] = useState(0);

  // What the server last told us about this document. It starts as the feed's copy and is refreshed while the
  // document is still being prepared.
  const [media, setMedia] = useState<DocumentMedia>(given);
  useEffect(() => setMedia(given), [given]);

  useEffect(() => {
    if (!postId || media.processingStatus !== 'pending') return;
    let stopped = false;
    const startedAt = Date.now();
    const timer = setInterval(async () => {
      if (stopped) return;
      if (Date.now() - startedAt > POLL_FOR_MS) {
        clearInterval(timer);
        return;
      }
      try {
        const res = await api.get(`/posts/${postId}`);
        const fresh = ((res.data?.data?.media ?? []) as DocumentMedia[]).find((m) => m.url === media.url);
        if (stopped || !fresh) return;
        // Only replace when something changed, so the page the person is reading does not flicker.
        if ((fresh.pages?.length ?? 0) !== (media.pages?.length ?? 0) || fresh.processingStatus !== media.processingStatus) {
          setMedia(fresh);
        }
      } catch {
        // No connection right now; try again at the next tick.
      }
    }, POLL_EVERY_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [postId, media.url, media.processingStatus, media.pages?.length]);

  const pages = useMemo(() => [...(media.pages ?? [])].sort((a, b) => a.page - b.page), [media.pages]);
  // How many pages there will be once it is done (drawn so far can be fewer), and what the document really has.
  const expected = Math.max(media.pageCount ?? 0, pages.length);
  const stillPreparing = media.processingStatus === 'pending' && pages.length > 0;
  const partlyFailed = media.processingStatus === 'failed' && pages.length > 0;
  const longNote = media.totalPages && media.totalPages > expected ? `First ${expected} of ${media.totalPages} pages` : null;
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
        nav: {
          position: 'absolute',
          top: '50%',
          marginTop: -20,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(15,23,42,0.72)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        navPrev: { left: Spacing.sm },
        navNext: { right: Spacing.sm },
        navDisabled: { opacity: 0.3 },
        navText: { color: '#FFFFFF', fontSize: 26, lineHeight: 28, fontWeight: '700' },
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

  // No page images. One card for every case, so a document never looks broken, and a tap always
  // opens the original file.
  if (pages.length === 0) {
    const pending = media.processingStatus === 'pending';
    const failed = media.processingStatus === 'failed';
    const hint = pending
      ? 'Preparing the pages. Page 1 will appear here by itself, or tap to open the file now.'
      : failed
        ? 'The pages could not be prepared. Tap to open the file.'
        : 'The pages are not ready yet. Tap to open the file.';
    return (
      <TouchableOpacity style={styles.card} onPress={openOriginal} accessibilityRole="button" accessibilityLabel={`Open ${name}`}>
        {pending ? <ActivityIndicator color={colors.primary} /> : <Text style={{ fontSize: 46 }}>📄</Text>}
        <Text style={styles.cardTitle} numberOfLines={2}>{name}</Text>
        <Text style={styles.cardHint}>{hint}</Text>
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

  // The arrows. Same result as a swipe.
  const goTo = (target: number) => {
    const i = Math.max(0, Math.min(pages.length - 1, target));
    setIndex(i);
    listRef.current?.scrollToIndex({ index: i, animated: true });
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
              ref={listRef}
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
                  accessibilityLabel={`Page ${item.page} of ${expected}. Tap to read full screen`}
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
              <Text style={styles.badgeText}>{index + 1} / {expected}</Text>
            </View>
            {pages.length > 1 && (
              <>
                <TouchableOpacity
                  style={[styles.nav, styles.navPrev, index === 0 && styles.navDisabled]}
                  onPress={() => goTo(index - 1)}
                  disabled={index === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Previous page"
                >
                  <Text style={styles.navText}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nav, styles.navNext, index === pages.length - 1 && styles.navDisabled]}
                  onPress={() => goTo(index + 1)}
                  disabled={index === pages.length - 1}
                  accessibilityRole="button"
                  accessibilityLabel="Next page"
                >
                  <Text style={styles.navText}>›</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <View style={styles.caption}>
            <Text style={styles.captionName} numberOfLines={1}>
              {name}
              {stillPreparing ? ' · preparing more pages…' : partlyFailed ? ' · some pages could not be prepared' : longNote ? ` · ${longNote}` : pages.length > 1 ? ' · swipe for more pages' : ''}
            </Text>
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
            <Text style={styles.fullCount}>{fullIndex + 1} / {expected}</Text>
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
