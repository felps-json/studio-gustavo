import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { COLORS } from '../constants/theme';
import { supabase } from '../services/supabase';

export default function StoreScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.log("Erro ao buscar produtos:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.img }} style={styles.img} />
      <Text style={styles.category}>{item.category}</Text>
      <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
      <Text style={styles.price}>R$ {item.price}</Text>
      {item.stock === 0 && <Text style={styles.outOfStock}>Esgotado</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.surface} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back-ios" size={20} color={COLORS.textLight} style={{marginLeft: 6}} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gustavo Store</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{ gap: 15 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListHeaderComponent={
            <View style={styles.infoBox}>
              <MaterialIcons name="storefront" size={20} color={COLORS.textSecondary} />
              <Text style={styles.infoText}>Produtos disponíveis para compra diretamente na barbearia.</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>Novos produtos em breve!</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: COLORS.surface },
  headerTitle: { color: COLORS.textLight, fontSize: 18, fontWeight: 'bold' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1E1E1E', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  infoBox: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8 },
  infoText: { color: COLORS.textSecondary, fontSize: 12, flex: 1, lineHeight: 18 },
  card: { flex: 1, maxWidth: '48%', backgroundColor: COLORS.surface, borderRadius: 12, padding: 10, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  img: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 10, backgroundColor: '#000' },
  category: { fontSize: 9, color: COLORS.textSecondary, textTransform: 'uppercase', fontWeight: 'bold' },
  title: { color: COLORS.textLight, fontSize: 14, fontWeight: 'bold', marginTop: 2 },
  price: { color: COLORS.primary, fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  outOfStock: { color: '#F44336', fontSize: 11, fontWeight: 'bold', marginTop: 4 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', fontStyle: 'italic', marginTop: 30 },
});
