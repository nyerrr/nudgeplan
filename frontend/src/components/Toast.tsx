import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../state';
import { fonts } from '../theme';

export function Toast() {
  const { toast, colors, undo } = useApp();
  const insets = useSafeAreaInsets();
  if (!toast) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { bottom: Math.max(86, insets.bottom + 76), left: 14, right: 14 },
      ]}
    >
      <View style={[styles.toast, { backgroundColor: colors.ink }]}>
        <Text
          style={{
            flex: 1,
            color: colors.bg,
            fontFamily: fonts.medium,
            fontSize: 13.5,
          }}
        >
          {toast.message}
        </Text>
        {toast.undo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo"
            onPress={undo}
            style={styles.undoHit}
          >
            <Text
              style={{
                color: colors.bg,
                fontFamily: fonts.bold,
                fontSize: 13.5,
                textDecorationLine: 'underline',
              }}
            >
              Undo
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 40,
  },
  toast: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  undoHit: {
    minWidth: 44,
    minHeight: 44,
    marginVertical: -12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
