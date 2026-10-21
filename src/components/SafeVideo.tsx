import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';

// Replaces the per-post players in the feeds. Problems this addresses:
//  - every video post created its own player the moment it mounted, so a scrolling feed held many
//    decoders at once (black frames, stutter, overlapping sound). Feed videos now start as a
//    poster and only create a player when tapped.
//  - nothing paused a video when the person left the screen or backgrounded the app. Both now pause.
//  - on Android the default surface can render wrongly inside scrolling lists; textureView is used.
// Reels only keep a player for the reel that is on screen.

function useIsPlayable() {
  const [focused, setFocused] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  return focused && appActive;
}

const surfaceType = Platform.OS === 'android' ? ('textureView' as const) : undefined;

function PlayingVideo({ uri, style, loop, cover, controls }: { uri: string; style: any; loop: boolean; cover: boolean; controls: boolean }) {
  const playable = useIsPlayable();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
  });

  useEffect(() => {
    if (playable) player.play();
    else player.pause();
  }, [playable, player]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // player already released
      }
    };
  }, [player]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={cover ? 'cover' : 'contain'}
      nativeControls={controls}
      fullscreenOptions={controls ? { enable: true } : undefined}
      surfaceType={surfaceType}
    />
  );
}

export function FeedVideo({ uri, height }: { uri: string; height: number }) {
  const [started, setStarted] = useState(false);
  const box = { width: '100%' as const, height, borderRadius: 8, backgroundColor: '#111111' };

  if (!started) {
    return (
      <TouchableOpacity
        style={[box, { alignItems: 'center', justifyContent: 'center' }]}
        onPress={() => setStarted(true)}
        accessibilityRole="button"
        accessibilityLabel="Play video"
      >
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22, color: '#111111', marginLeft: 3 }}>▶</Text>
        </View>
      </TouchableOpacity>
    );
  }
  return <PlayingVideo uri={uri} style={box} loop={false} cover={false} controls />;
}

export function ReelVideo({ uri, active, style }: { uri: string; active: boolean; style: any }) {
  if (!active) return <View style={[style, { backgroundColor: '#000000' }]} />;
  // contain, not cover: the whole video is always visible (cover cropped it and ran past the screen)
  return <PlayingVideo uri={uri} style={style} loop cover={false} controls={false} />;
}
