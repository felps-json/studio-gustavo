import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Alert, ActivityIndicator, Linking
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { COLORS } from '../constants/theme';
import Avatar from '../components/Avatar';
import { PRIVACY_POLICY_URL } from '../constants/business';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function AccountScreen({ navigation }) {
  const { user, profile, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const handleLogout = () => {
    Alert.alert(
        "Sair",
        "Deseja realmente sair da sua conta?",
        [
            { text: "Cancelar", style: "cancel" },
            { text: "Sair", onPress: signOut, style: 'destructive' }
        ]
    );
  };

  const openPrivacyPolicy = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch(() => Alert.alert("Erro", "Não foi possível abrir a política de privacidade."));
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      // A exclusão roda no servidor (Edge Function), pois exige a chave de administrador do Supabase
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;

      Alert.alert("Conta excluída", "Sua conta e seus dados pessoais foram removidos.");
      await signOut();
    } catch (error) {
      console.log("Erro ao excluir conta:", error);
      Alert.alert("Erro", "Não foi possível excluir sua conta agora. Tente novamente mais tarde.");
      setDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Excluir Conta",
      "Esta ação é permanente. Seus dados pessoais, pontos de fidelidade e agendamentos futuros serão apagados. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: 'destructive', onPress: deleteAccount }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.surface} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back-ios" size={20} color={COLORS.textLight} style={{marginLeft: 6}} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Minha Conta</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.profileBox}>
          <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={90} style={styles.avatar} />
          <Text style={styles.name}>{profile?.full_name}</Text>
          <Text style={styles.info}>{user?.email}</Text>
          <Text style={styles.info}>{profile?.phone}</Text>
        </View>

        <TouchableOpacity style={styles.row} onPress={openPrivacyPolicy}>
          <MaterialIcons name="privacy-tip" size={22} color={COLORS.textSecondary} />
          <Text style={styles.rowText}>Política de Privacidade</Text>
          <MaterialIcons name="chevron-right" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={handleLogout}>
          <MaterialIcons name="logout" size={22} color={COLORS.textSecondary} />
          <Text style={styles.rowText}>Sair da conta</Text>
          <MaterialIcons name="chevron-right" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator color="#F44336" />
          ) : (
            <>
              <MaterialIcons name="delete-forever" size={20} color="#F44336" />
              <Text style={styles.deleteText}>EXCLUIR MINHA CONTA</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: COLORS.surface },
  headerTitle: { color: COLORS.textLight, fontSize: 18, fontWeight: 'bold' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1E1E1E', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  content: { padding: 20 },
  profileBox: { alignItems: 'center', marginBottom: 30 },
  avatar: { borderWidth: 2, borderColor: COLORS.primary, marginBottom: 15 },
  name: { color: COLORS.textLight, fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  info: { color: COLORS.textSecondary, fontSize: 14, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.surface, padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  rowText: { flex: 1, color: COLORS.textLight, fontSize: 15 },
  deleteBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 30, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(244, 67, 54, 0.4)', backgroundColor: 'rgba(244, 67, 54, 0.08)' },
  deleteText: { color: '#F44336', fontWeight: 'bold', fontSize: 13, letterSpacing: 1 },
});
