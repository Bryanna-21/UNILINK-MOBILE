import { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';

// STATUS: REAL — staff-only (route access itself is gated by the
// "Scan Check-in" entry point only appearing for lecturer/admin roles
// in events/index.tsx; the backend's POST /api/events/check-in ALSO
// independently re-checks isStaff(req.user.role), so a student who
// somehow navigated here directly still can't check anyone in — this
// screen is a convenience, not the actual security boundary).
//
// Scans a QR code's raw string value and POSTs it as `qrToken` to the
// real check-in endpoint, which looks up the matching RSVP, rejects
// an already-checked-in one, and marks it checked in. No local
// simulation of any of that logic — the backend is the sole source
// of truth for whether a check-in is valid.
//
// Debounced by lastScannedRef, not just a loading flag: expo-camera's
// onBarcodeScanned fires repeatedly (many times a second) for as long
// as a code is in frame, not once per code. Without tracking the
// specific token already in flight, holding the camera steady on one
// person's QR for half a second would fire the same check-in request
// dozens of times.
export default function ScanCheckinScreen() {
  const colors = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        camera: { flex: 1 },
        overlay: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: Spacing.lg,
          backgroundColor: colors.background,
          borderTopLeftRadius: Radius.md,
          borderTopRightRadius: Radius.md,
        },
        resultText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
        resultOk: { color: colors.primary },
        resultFail: { color: '#DC2626' },
        hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: Spacing.xs },
        permissionContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: Spacing.lg,
          backgroundColor: colors.background,
        },
        permissionText: { fontSize: 14, color: colors.text, textAlign: 'center', marginBottom: Spacing.md },
        permissionButton: {
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.xl,
        },
        permissionButtonText: { color: colors.white, fontWeight: '700' },
        closeButton: { position: 'absolute', top: Spacing.xl, right: Spacing.lg, zIndex: 1 },
        closeButtonText: { fontSize: 28, color: colors.white },
      }),
    [colors]
  );

  const handleScan = useCallback(async (result: BarcodeScanningResult) => {
    const token = result.data;
    if (!token || token === lastScannedRef.current || inFlightRef.current) return;

    inFlightRef.current = true;
    lastScannedRef.current = token;
    setIsProcessing(true);
    setLastResult(null);
    try {
      const res = await api.post('/events/check-in', { qrToken: token });
      setLastResult({ ok: true, message: 'Checked in successfully.' });
      // Deliberately short-lived: allow re-scanning the SAME token
      // again after a few seconds only so a staff member can retry if
      // they misread the confirmation, not so the camera silently
      // spam-checks-in on every frame — see debounce note above.
      setTimeout(() => {
        lastScannedRef.current = null;
      }, 3000);
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Could not check in this code.';
      setLastResult({ ok: false, message });
      setTimeout(() => {
        lastScannedRef.current = null;
      }, 2000);
    } finally {
      inFlightRef.current = false;
      setIsProcessing(false);
    }
  }, []);

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          Camera access is needed to scan check-in codes.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
          accessibilityRole="button"
          accessibilityLabel="Grant camera permission"
        >
          <Text style={styles.permissionButtonText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBanner status="real" note="Scans real QR codes and checks in against the live backend." />
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScan}
      >
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </CameraView>

      <View style={styles.overlay}>
        {isProcessing ? (
          <ActivityIndicator color={colors.primary} />
        ) : lastResult ? (
          <Text style={[styles.resultText, lastResult.ok ? styles.resultOk : styles.resultFail]}>
            {lastResult.ok ? '✓ ' : '✕ '}
            {lastResult.message}
          </Text>
        ) : (
          <Text style={styles.hint}>Point the camera at a student's check-in QR code.</Text>
        )}
      </View>
    </View>
  );
}
