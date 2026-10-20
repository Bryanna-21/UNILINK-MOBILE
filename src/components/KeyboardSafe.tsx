import { ReactNode } from 'react';
import { KeyboardAvoidingView, StyleProp, ViewStyle } from 'react-native';

// Keeps a screen's text fields above the on-screen keyboard.
//
// Why this exists: Android builds on Expo 57 draw edge to edge, so the old behaviour of the
// window shrinking when the keyboard opens no longer happens. A KeyboardAvoidingView with
// behavior="padding" is what moves the content instead, and it must be "padding" on Android as
// well as iOS (the AI screen used `undefined` on Android and its input sat under the keyboard).
//
// Use it as the outermost element of a screen, or inside a <Modal> (a Modal is its own window,
// so it does not inherit the screen's keyboard handling).
//   offset: extra space to keep above the keyboard, e.g. the height of a native header.
export default function KeyboardSafe({
  children,
  style,
  offset = 0,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  offset?: number;
}) {
  return (
    <KeyboardAvoidingView style={[{ flex: 1 }, style]} behavior="padding" keyboardVerticalOffset={offset}>
      {children}
    </KeyboardAvoidingView>
  );
}
