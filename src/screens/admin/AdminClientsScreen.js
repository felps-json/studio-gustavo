import React, { useState, useCallback } from 'react';
import { 
  View, Text, TextInput, FlatList, TouchableOpacity, 
  StyleSheet, Linking, Alert, ActivityIndicator, RefreshControl 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { COLORS } from '../../constants/theme';
import Avatar from '../../components/Avatar';
import { supabase } from '../../services/supabase';

export default function AdminClientsScreen({ navigation }) {
  const [searchText, setSearchText] = useState('');
  
  const [allClients, setAllClients] = useState([]);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClientsData = async () => {
    try {
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (profError) throw profError;

      const { data: appointments, error: apptError } = await supabase
        .from('appointments')
        .select('user_id, status, date');

      if (apptError) throw apptError;

      const clientsData = profiles.map(profile => {
        const userAppts = appointments.filter(a => a.user_id === profile.id);
        const completed = userAppts.filter(a => a.status === 'completed');
        
        let lastVisitDate = 'Nenhuma';
        if (completed.length > 0) {
          const sortedCompleted = completed.sort((a, b) => new Date(b.date) - new Date(a.date));
          lastVisitDate = format(parseISO(sortedCompleted[0].date), 'dd/MM/yyyy');
        }

        const upcoming = userAppts.filter(a => a.status === 'pending' || a.status === 'confirmed');
        let upcomingDateStr = null;
        if (upcoming.length > 0) {
           const sortedUpcoming = upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
           upcomingDateStr = format(parseISO(sortedUpcoming[0].date), "dd 'de' MMM", { locale: ptBR });
        }

        return {
          id: profile.id,
          name: profile.full_name || 'Cliente Sem Nome',
          phone: profile.phone || '',
          email: profile.email || 'Sem E-mail',
          avatar: profile.avatar_url,
          totalVisits: completed.length,
          lastVisit: lastVisitDate,
          upcomingAppt: upcomingDateStr,
          points: profile.loyalty_points || 0, // NOVO: Pegando os pontos reais do banco
        };
      });

      setAllClients(clientsData);
      setList(clientsData);
    } catch (error) {
      console.log("Erro ao buscar clientes:", error);
      Alert.alert("Erro", "Não foi possível carregar a lista de clientes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchClientsData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchClientsData();
  };

  const handleSearch = (text) => {
    setSearchText(text);
    if (text === '') {
      setList(allClients);
    } else {
      const lowerText = text.toLowerCase();
      const filtered = allClients.filter(client => 
        client.name.toLowerCase().includes(lowerText) ||
        client.email.toLowerCase().includes(lowerText) ||
        client.phone.includes(text)
      );
      setList(filtered);
    }
  };

  const openWhatsApp = (phone) => {
    if (!phone) {
        Alert.alert("Aviso", "Este cliente não possui número de telefone cadastrado.");
        return;
    }
    const number = phone.replace(/\D/g, '');
    const url = `https://wa.me/55${number}`;
    Linking.openURL(url).catch(() => Alert.alert("Erro", "Não foi possível abrir o WhatsApp"));
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar uri={item.avatar} name={item.name} size={50} style={styles.avatar} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.info}><MaterialIcons name="phone" size={12} /> {item.phone || 'Não informado'}</Text>
          <Text style={styles.info}><MaterialIcons name="email" size={12} /> {item.email}</Text>
        </View>
        <TouchableOpacity onPress={() => openWhatsApp(item.phone)} style={styles.zapBtn}>
           <MaterialIcons name="chat" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {item.upcomingAppt && (
        <View style={styles.upcomingBadge}>
            <MaterialIcons name="event" size={14} color="#155724" />
            <Text style={styles.upcomingText}>
                Agendado: <Text style={{fontWeight:'bold', textTransform: 'capitalize'}}>{item.upcomingAppt}</Text>
            </Text>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={styles.statsRow}>
            <View style={{marginRight: 15}}>
                <Text style={styles.label}>Total Cortes</Text>
                <Text style={styles.value}>{item.totalVisits}</Text>
            </View>
            <View style={{marginRight: 15}}>
                <Text style={styles.label}>Última Visita</Text>
                <Text style={styles.value}>{item.lastVisit}</Text>
            </View>
            {/* NOVO: Exibindo os pontos */}
            <View>
                <Text style={styles.label}>Pontos</Text>
                <Text style={[styles.value, { color: COLORS.primary }]}>{item.points}</Text>
            </View>
        </View>
        
        {/* NOVO: Botão funcionando e enviando os dados do cliente para a ServiceSelection */}
        <TouchableOpacity 
          style={styles.bookBtn}
          onPress={() => {
            navigation.navigate('ServiceSelection', { 
              isAdminMode: true, 
              clientData: item 
            });
          }}
        >
          <Text style={styles.bookBtnText}>Agendar</Text>
          <MaterialIcons name="add-circle" size={16} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestão de Clientes</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color={COLORS.textSecondary} />
        <TextInput 
          placeholder="Buscar cliente..." 
          placeholderTextColor={COLORS.textSecondary}
          style={styles.input}
          value={searchText}
          onChangeText={handleSearch}
        />
        {searchText !== '' && (
            <TouchableOpacity onPress={() => handleSearch('')}>
                <MaterialIcons name="close" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList 
          data={list}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
                <MaterialIcons name="group-off" size={60} color="#333" />
                <Text style={styles.empty}>Nenhum cliente encontrado.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: COLORS.surface },
  headerTitle: { color: COLORS.textLight, fontSize: 20, fontWeight: 'bold' },
  
  searchContainer: { flexDirection: 'row', backgroundColor: COLORS.surface, marginHorizontal: 20, marginTop: 20, padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  input: { flex: 1, color: COLORS.textLight, marginLeft: 10, fontSize: 16 },
  
  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { borderWidth: 1, borderColor: '#333' },
  name: { color: COLORS.textLight, fontSize: 18, fontWeight: 'bold' },
  info: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  
  zapBtn: { backgroundColor: '#25D366', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  
  upcomingBadge: { 
      marginTop: 15, 
      backgroundColor: '#D4EDDA', 
      paddingVertical: 6, 
      paddingHorizontal: 10, 
      borderRadius: 8, 
      flexDirection: 'row', 
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start' 
  },
  upcomingText: { color: '#155724', fontSize: 12 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 15 },
  
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsRow: { flexDirection: 'row' }, 
  
  label: { color: COLORS.textSecondary, fontSize: 10, textTransform: 'uppercase', marginBottom: 2 },
  value: { color: COLORS.textLight, fontSize: 14, fontWeight: 'bold' },
  
  bookBtn: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', gap: 6 },
  bookBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },

  emptyContainer: { alignItems: 'center', marginTop: 60 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 15 }
});