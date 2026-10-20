import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, 
  ImageBackground, StatusBar, RefreshControl, ActivityIndicator, Alert 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import { COLORS } from '../constants/theme';
import { BARBER } from '../constants/business';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

export default function HomeScreen({ navigation }) {
  const { profile, refreshProfile, signOut } = useAuth();
  
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .limit(5);
      if (!error) setServices(data || []);
    } catch (error) {
      console.log(error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5); 
      if (!error) setProducts(data || []);
    } catch (error) {
      console.log(error);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([fetchServices(), fetchProducts()]);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadAllData();
      refreshProfile(); 
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadAllData();
    refreshProfile();
  };

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

  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'Cliente';
  
  const currentPoints = profile?.loyalty_points || 0;
  const goalPoints = profile?.loyalty_goal || 100;
  const progress = (currentPoints / goalPoints) * 100;
  const progressWidth = Math.min(progress, 100);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 100 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        
        {/* === HERO SECTION === */}
        <ImageBackground 
          source={{ uri: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80' }} 
          style={styles.hero}
        >
          <LinearGradient colors={['rgba(18,18,18,0.3)', '#121212']} style={styles.heroGradient}>
            
            {/* HEADER COM LOGOUT E LOGO OFICIAL */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                 <Image 
                    source={require('../../assets/logo.png')} 
                    style={styles.homeLogoImage} 
                    resizeMode="contain"
                 />
              </View>
              
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 15}}>
                  <TouchableOpacity onPress={() => navigation.navigate('Account')}>
                    <Image 
                        source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/150' }} 
                        style={styles.headerAvatar} 
                    />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                    <MaterialIcons name="logout" size={24} color="#FF6B6B" />
                  </TouchableOpacity>
              </View>
            </View>

            <View style={styles.heroContent}>
              <Text style={styles.estText}>BEM-VINDO, {firstName.toUpperCase()}</Text>
              <Text style={styles.welcomeTitle}>A ARTE DO <Text style={{ color: COLORS.primary }}>CORTE</Text></Text>
              <Text style={styles.subText}>Exclusividade, técnica e um ambiente pensado para você.</Text>
              
              <View style={styles.heroActions}>
                <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('ServiceSelection')}>
                  <Text style={styles.btnText}>AGENDAR AGORA</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>

        {/* === CARTÃO FIDELIDADE === */}
        <View style={styles.loyaltySection}>
            <View style={styles.loyaltyCard}>
                <View style={styles.loyaltyRow}>
                    <View>
                        <Text style={styles.loyaltyLabel}>SEUS PONTOS</Text>
                        <Text style={styles.loyaltyPoints}>{currentPoints} <Text style={{fontSize: 14, color: '#888'}}>/ {goalPoints}</Text></Text>
                    </View>
                    <MaterialIcons name="stars" size={32} color={COLORS.primary} />
                </View>
                
                <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${progressWidth}%` }]} />
                </View>
                
                <Text style={styles.loyaltyFooter}>
                    {currentPoints >= goalPoints 
                        ? "🎉 Parabéns! Você ganhou um corte grátis!" 
                        : `Faltam ${goalPoints - currentPoints} pontos para o seu prêmio.`}
                </Text>
            </View>
        </View>

        {/* === SERVIÇOS === */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nossos Serviços</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ServiceSelection')}>
                <Text style={styles.linkText}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 20 }}>
            {loading ? (
                <ActivityIndicator color={COLORS.primary} />
            ) : services.length === 0 ? (
                <Text style={{color: COLORS.textSecondary}}>Nenhum serviço disponível.</Text>
            ) : (
                services.map((service) => (
                    <TouchableOpacity 
                        key={service.id} 
                        style={styles.serviceCard}
                        onPress={() => navigation.navigate('ServiceSelection')}
                    >
                        <View style={styles.serviceIconBox}>
                            <MaterialIcons name={service.icon || 'content-cut'} size={30} color={COLORS.primary} />
                        </View>
                        <View style={styles.serviceContent}>
                            <Text style={styles.serviceTitle}>{service.title}</Text>
                            <Text style={styles.servicePrice}>R$ {service.price}</Text>
                            <Text style={styles.serviceDuration}>{service.duration} min</Text>
                        </View>
                    </TouchableOpacity>
                ))
            )}
          </ScrollView>
        </View>

        {/* === PERFIL BARBEIRO === */}
        <View style={styles.section}>
          <View style={styles.profileCard}>
            <Image
              source={BARBER.photo || require('../../assets/logo.png')}
              style={styles.profileImg}
              resizeMode={BARBER.photo ? 'cover' : 'contain'}
            />
            <View style={styles.profileContent}>
              <Text style={styles.profileLabel}>O ESPECIALISTA</Text>
              <Text style={styles.profileName}>{BARBER.name}</Text>
              <Text style={styles.profileBio}>{BARBER.bio}</Text>
            </View>
          </View>
        </View>

        {/* === LOJA === */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Gustavo Store</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Store')}><Text style={styles.linkText}>Ir para Loja</Text></TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 20 }}>
            {loading ? (
                <ActivityIndicator color={COLORS.primary} />
            ) : products.length === 0 ? (
                <Text style={{color: COLORS.textSecondary, fontStyle: 'italic'}}>Novos produtos em breve!</Text>
            ) : (
                products.map((product) => (
                  <TouchableOpacity key={product.id} style={styles.productCard} onPress={() => navigation.navigate('Store')}>
                    <Image source={{ uri: product.img }} style={styles.productImg} />
                    <View style={styles.productContent}>
                      <Text style={styles.productCategory}>{product.category}</Text>
                      <Text numberOfLines={1} style={styles.productTitle}>{product.title}</Text>
                      <Text style={styles.productPrice}>R$ {product.price}</Text>
                    </View>
                  </TouchableOpacity>
                ))
            )}
          </ScrollView>
        </View>

      </ScrollView>

      {/* === BOTTOM NAV === */}
      <View style={styles.bottomNav}>
        <TouchableOpacity>
            <MaterialIcons name="home" size={28} color={COLORS.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.fabBtn} onPress={() => navigation.navigate('ServiceSelection')}>
          <MaterialIcons name="content-cut" size={28} color={COLORS.white} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
            <MaterialIcons name="event-note" size={28} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  
  // HERO
  hero: { height: 380, width: '100%' },
  heroGradient: { flex: 1, justifyContent: 'space-between', paddingBottom: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 50, paddingHorizontal: 20 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  
  logoContainer: { alignItems: 'flex-start' },
  homeLogoImage: { width: 140, height: 50 }, // Retangular para caber no cabeçalho
  
  heroContent: { paddingHorizontal: 20 },
  estText: { color: COLORS.primary, fontSize: 12, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  welcomeTitle: { color: COLORS.textLight, fontSize: 38, fontWeight: 'bold', lineHeight: 38, textTransform: 'uppercase' },
  subText: { color: COLORS.textSecondary, marginTop: 10, fontSize: 14, lineHeight: 20, maxWidth: '75%' },
  heroActions: { marginTop: 25 },
  btnPrimary: { backgroundColor: COLORS.primary, height: 50, width: 180, borderRadius: 8, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 10 },
  btnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
  
  // SEÇÕES GERAIS
  section: { marginTop: 30 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  sectionTitle: { color: COLORS.textLight, fontSize: 18, fontWeight: 'bold' },
  linkText: { color: COLORS.primary, fontSize: 12, fontWeight: 'bold' },

  // FIDELIDADE
  loyaltySection: { paddingHorizontal: 20, marginTop: -30 }, 
  loyaltyCard: { backgroundColor: '#1E1E1E', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#333', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 },
  loyaltyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  loyaltyLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  loyaltyPoints: { color: COLORS.textLight, fontSize: 24, fontWeight: 'bold' },
  progressBg: { height: 6, backgroundColor: '#333', borderRadius: 3, marginBottom: 10 },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
  loyaltyFooter: { color: COLORS.textSecondary, fontSize: 11, fontStyle: 'italic' },

  // CARD DE SERVIÇO
  serviceCard: { width: 130, height: 130, backgroundColor: COLORS.surface, borderRadius: 12, marginRight: 15, padding: 12, justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  serviceIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(212, 163, 115, 0.1)', justifyContent: 'center', alignItems: 'center' },
  serviceContent: { gap: 2 },
  serviceTitle: { color: COLORS.textLight, fontSize: 13, fontWeight: 'bold' },
  servicePrice: { color: COLORS.primary, fontSize: 14, fontWeight: 'bold' },
  serviceDuration: { color: COLORS.textSecondary, fontSize: 10 },

  // CARD PERFIL
  profileCard: { marginHorizontal: 20, backgroundColor: COLORS.surface, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', height: 130 },
  profileImg: { width: 100, height: '100%' },
  profileContent: { flex: 1, padding: 15, justifyContent: 'center' },
  profileLabel: { color: COLORS.primary, fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 },
  profileName: { color: COLORS.textLight, fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  profileBio: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16 },

  // CARD PRODUTO
  productCard: { width: 140, backgroundColor: COLORS.surface, borderRadius: 12, marginRight: 15, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  productImg: { width: '100%', height: 100, borderRadius: 8, marginBottom: 10, backgroundColor: '#000' },
  productContent: { gap: 2 },
  productCategory: { fontSize: 9, color: COLORS.textSecondary, textTransform: 'uppercase', fontWeight: 'bold' },
  productTitle: { color: COLORS.textLight, fontSize: 14, fontWeight: 'bold' },
  productPrice: { color: COLORS.primary, fontSize: 14, fontWeight: 'bold', marginTop: 2 },

  // BOTTOM NAV
  bottomNav: { position: 'absolute', bottom: 20, left: 20, right: 20, height: 70, backgroundColor: 'rgba(30,30,30,0.95)', borderRadius: 20, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.5, shadowRadius: 20 },
  fabBtn: { top: -25, backgroundColor: COLORS.primary, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: COLORS.background, shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 10 }
});