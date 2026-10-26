import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

// Foto do perfil ou, se não houver, as iniciais do nome (geradas no próprio app,
// sem enviar o nome do cliente para serviços externos).
function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export default function Avatar({ uri, name, size = 40, style }) {
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[shape, style]} />;
  }

  return (
    <View style={[shape, styles.fallback, style]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: COLORS.surfaceHighlight, justifyContent: 'center', alignItems: 'center' },
  initials: { color: COLORS.primary, fontWeight: 'bold' },
});
