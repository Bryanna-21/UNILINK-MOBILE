import { Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';

// STATUS: REAL. Tap a profile photo to see it full size. Tap anywhere, or Close, to go back.
// With no photo it shows the initials large, so the tap always does something sensible.

export default function AvatarLightbox({ visible, name, uri, onClose }: { visible: boolean; name?: string; uri?: string | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const side = Math.min(width - 32, height - 160);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close photo">
        <View style={{ alignItems: 'center' }}>
          {uri ? (
            <Image source={{ uri }} style={{ width: side, height: side, borderRadius: 12 }} resizeMode="contain" accessibilityLabel={`${name || 'Profile'} photo`} />
          ) : (
            <Avatar name={name} size={Math.min(side, 220)} />
          )}
          {name ? <Text style={styles.name}>{name}</Text> : null}
        </View>
        <TouchableOpacity style={[styles.close, { top: insets.top + 12 }]} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close photo">
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  name: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginTop: 16 },
  close: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
});
