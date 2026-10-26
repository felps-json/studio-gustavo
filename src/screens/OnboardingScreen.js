import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  StatusBar, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function OnboardingScreen() {
  const { user, refreshProfile, signOut } = useAuth(); 
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    // 1. Validação
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Campos Vazios", "Por favor, preencha seu nome e telefone.");
      return;
    }

    setLoading(true);

    try {
      console.log("Tentando salvar dados para ID:", user.id);

      // 2. Prepara os dados (sem foto: o app mostra as iniciais do nome)
      const profileData = {
        id: user.id, // OBRIGATÓRIO para o upsert saber quem é
        full_name: name,
        phone: phone,
        updated_at: new Date(),
        // role e loyalty_points são definidos pelo banco (o app não pode alterá-los)
      };

      // 3. UPSERT: Se existir atualiza, se não existir cria.
      const { data, error } = await supabase
        .from('profiles')
        .upsert(profileData)
        .select();

      if (error) {
        console.error("Erro Supabase:", error);
        throw error;
      }

      console.log("Sucesso! Dados salvos:", data);

      // 4. Atualiza o App
      await refreshProfile(); 

    } catch (error) {
      console.log("Erro Catch:", error);
      Alert.alert("Erro ao Salvar", error.message || "Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{flex: 1}}
      >
        <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}>
          
          <View style={styles.content}>
            {/* CABEÇALHO */}
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                  <MaterialIcons name="person-add" size={50} color={COLORS.primary} />
                </View>
                <Text style={styles.title}>Quase lá!</Text>
                <Text style={styles.subtitle}>
                    Para finalizar seu cadastro, precisamos do seu nome e WhatsApp para contato.
                </Text>
            </View>

            {/* FORMULÁRIO */}
            <View style={styles.form}>
                
                {/* Input Nome */}
                <Text style={styles.label}>Seu Nome Completo</Text>
                <View style={styles.inputContainer}>
                    <MaterialIcons name="person" size={20} color={COLORS.textSecondary} />
                    <TextInput 
                        style={styles.input}
                        placeholder="Ex: João Silva"
                        placeholderTextColor="#666"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                    />
                </View>

                {/* Input Telefone */}
                <Text style={styles.label}>Seu WhatsApp</Text>
                <View style={styles.inputContainer}>
                    <MaterialIcons name="phone" size={20} color={COLORS.textSecondary} />
                    <TextInput 
                        style={styles.input}
                        placeholder="Ex: 11 99999-9999"
                        placeholderTextColor="#666"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                    />
                </View>

                {/* Botão Salvar */}
                <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                          <Text style={styles.btnText}>CONCLUIR CADASTRO</Text>
                          <MaterialIcons name="check" size={24} color="white" />
                        </>
                    )}
                </TouchableOpacity>

                {/* Botão de Logout (Salva-vidas) */}
                <TouchableOpacity 
                    onPress={signOut} 
                    style={styles.logoutBtn}
                >
                    <Text style={styles.logoutText}>
                        Sair / Entrar com outra conta
                    </Text>
                </TouchableOpacity>

            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20 },
  
  content: { 
    backgroundColor: COLORS.surface, 
    padding: 24, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.05)',
    elevation: 8,
  },
  
  header: { alignItems: 'center', marginBottom: 30 },
  iconContainer: {
    width: 80, height: 80, borderRadius: 40, 
    backgroundColor: 'rgba(212, 163, 115, 0.1)', 
    justifyContent: 'center', alignItems: 'center', marginBottom: 15,
    borderWidth: 1, borderColor: COLORS.primary
  },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.textLight, marginBottom: 10 },
  subtitle: { color: COLORS.textSecondary, textAlign: 'center', fontSize: 14, lineHeight: 22 },

  form: { width: '100%' },
  label: { color: COLORS.textSecondary, marginBottom: 8, fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 1 },
  
  inputContainer: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: '#121212', height: 56, borderRadius: 12, 
    paddingHorizontal: 15, marginBottom: 20, 
    borderWidth: 1, borderColor: '#333' 
  },
  input: { flex: 1, color: COLORS.textLight, marginLeft: 10, fontSize: 16 },

  btn: { 
    backgroundColor: COLORS.primary, height: 56, borderRadius: 12, 
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
    gap: 10, marginTop: 10
  },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },

  logoutBtn: { marginTop: 25, padding: 10, alignItems: 'center' },
  logoutText: { color: '#FF6B6B', fontSize: 14, textDecorationLine: 'underline' }
});