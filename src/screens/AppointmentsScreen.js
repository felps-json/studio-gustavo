import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  StatusBar, ActivityIndicator, Alert, RefreshControl 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { COLORS } from '../constants/theme';
import { DB_ERRORS } from '../constants/errors';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function AppointmentsScreen({ navigation }) {
  const { user } = useAuth();
  const { cancellation_min_hours: CANCELLATION_MIN_HOURS } = useBusinessSettings();

  const [activeTab, setActiveTab] = useState('upcoming'); 
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMyAppointments = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('time', { ascending: false });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.log("Erro ao buscar meus agendamentos:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchMyAppointments();
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyAppointments();
  };

  // Só permite cancelar pelo app com a antecedência mínima configurada
  const canCancel = (appt) => {
    const start = parseISO(`${appt.date}T${appt.time.substring(0, 5)}:00`);
    return differenceInMinutes(start, new Date()) >= CANCELLATION_MIN_HOURS * 60;
  };

  const handleCancel = (appt) => {
    if (!canCancel(appt)) {
      Alert.alert(
        "Cancelamento indisponível",
        `Cancelamentos pelo app só são aceitos com ${CANCELLATION_MIN_HOURS}h de antecedência. Fale diretamente com a barbearia.`
      );
      return;
    }

    const id = appt.id;
    Alert.alert(
      "Cancelar Agendamento",
      "Tem certeza que deseja cancelar este horário? A vaga será liberada.",
      [
        { text: "Não", style: "cancel" },
        { 
          text: "Sim, Cancelar", 
          style: 'destructive',
          onPress: async () => {
            try {
              setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a));
              
              const { error } = await supabase
                .from('appointments')
                .update({ status: 'cancelled' })
                .eq('id', id);

              if (error) throw error;
            } catch (error) {
              Alert.alert("Erro", error?.code === DB_ERRORS.CANCELLATION_DEADLINE
                ? `Cancelamentos pelo app só são aceitos com ${CANCELLATION_MIN_HOURS}h de antecedência.`
                : "Não foi possível cancelar.");
              fetchMyAppointments();
            }
          } 
        }
      ]
    );
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const upcoming = appointments.filter(a => 
    a.date >= todayStr && (a.status === 'pending' || a.status === 'confirmed')
  ).reverse(); 

  const history = appointments.filter(a => 
    a.date < todayStr || a.status === 'completed' || a.status === 'cancelled' || a.status === 'declined'
  );

  const displayList = activeTab === 'upcoming' ? upcoming : history;

  const getStatusConfig = (status) => {
    switch(status) {
      case 'pending': return { text: 'Em Análise', color: '#FFC107', bg: 'rgba(255, 193, 7, 0.1)', icon: 'schedule' };
      case 'confirmed': return { text: 'Confirmado', color: '#4CAF50', bg: 'rgba(76, 175, 80, 0.1)', icon: 'check-circle' };
      case 'completed': return { text: 'Concluído', color: COLORS.primary, bg: 'rgba(212, 163, 115, 0.1)', icon: 'done-all' };
      case 'cancelled': return { text: 'Cancelado', color: '#F44336', bg: 'rgba(244, 67, 54, 0.1)', icon: 'cancel' };
      case 'declined': return { text: 'Recusado', color: '#F44336', bg: 'rgba(244, 67, 54, 0.1)', icon: 'block' };
      default: return { text: status, color: '#999', bg: '#222', icon: 'info' };
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.surface} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back-ios" size={20} color={COLORS.textLight} style={{marginLeft: 6}} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meus Agendamentos</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'upcoming' && styles.tabBtnActive]}
            onPress={() => setActiveTab('upcoming')}
        >
            <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>Próximos</Text>
        </TouchableOpacity>
        <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
            onPress={() => setActiveTab('history')}
        >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>Histórico</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : displayList.length === 0 ? (
            <View style={styles.emptyState}>
                <MaterialIcons name="event-busy" size={60} color="#333" />
                <Text style={styles.emptyTitle}>Nenhum agendamento</Text>
                <Text style={styles.emptyDesc}>
                    {activeTab === 'upcoming' 
                        ? "Você não possui horários marcados para o futuro." 
                        : "Seu histórico de cortes está vazio."}
                </Text>
                {activeTab === 'upcoming' ? (
                    <TouchableOpacity style={styles.bookBtn} onPress={() => navigation.navigate('ServiceSelection')}>
                        <Text style={styles.bookBtnText}>AGENDAR AGORA</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        ) : (
            displayList.map(item => {
                const statusConf = getStatusConfig(item.status);
                const dateObj = parseISO(item.date);
                
                return (
                    <View key={item.id} style={styles.card}>
                        
                        <View style={styles.cardHeader}>
                            <View style={[styles.statusBadge, { backgroundColor: statusConf.bg }]}>
                                <MaterialIcons name={statusConf.icon} size={14} color={statusConf.color} />
                                <Text style={[styles.statusText, { color: statusConf.color }]}>{statusConf.text}</Text>
                            </View>
                            <Text style={styles.priceText}>R$ {item.price}</Text>
                        </View>

                        <View style={styles.cardBody}>
                            <View style={styles.dateBox}>
                                <Text style={styles.dateDay}>{format(dateObj, 'dd')}</Text>
                                <Text style={styles.dateMonth}>{format(dateObj, 'MMM', { locale: ptBR }).toUpperCase()}</Text>
                            </View>
                            
                            <View style={styles.infoBox}>
                                <Text style={styles.serviceName} numberOfLines={2}>{item.service_names}</Text>
                                <View style={styles.timeRow}>
                                    <MaterialIcons name="access-time" size={14} color={COLORS.textSecondary} />
                                    <Text style={styles.timeText}>{item.time.substring(0, 5)} • {item.duration || 30} min</Text>
                                </View>
                            </View>
                        </View>

                        {activeTab === 'upcoming' ? (
                            canCancel(item) ? (
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item)}>
                                    <Text style={styles.cancelBtnText}>CANCELAR HORÁRIO</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.cancelBtn}>
                                    <Text style={styles.cancelInfoText}>
                                        Cancelamento só com {CANCELLATION_MIN_HOURS}h de antecedência. Fale com a barbearia.
                                    </Text>
                                </View>
                            )
                        ) : null}
                    </View>
                )
            })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingTop: 60, 
    paddingBottom: 20, 
    paddingHorizontal: 20, 
    backgroundColor: COLORS.surface 
  },
  headerTitle: { color: COLORS.textLight, fontSize: 18, fontWeight: 'bold' },
  backBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#1E1E1E', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#333' 
  },
  tabContainer: { flexDirection: 'row', marginHorizontal: 20, marginTop: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#333' },
  tabText: { color: COLORS.textSecondary, fontWeight: 'bold', fontSize: 14 },
  tabTextActive: { color: COLORS.textLight },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyTitle: { color: COLORS.textLight, fontSize: 18, fontWeight: 'bold', marginTop: 20 },
  emptyDesc: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 10, marginHorizontal: 40, lineHeight: 20 },
  bookBtn: { marginTop: 30, backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 30, borderRadius: 12 },
  bookBtnText: { color: 'white', fontWeight: 'bold', letterSpacing: 1 },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  statusText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  priceText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 16 },
  cardBody: { flexDirection: 'row', alignItems: 'center' },
  dateBox: { backgroundColor: '#1E1E1E', width: 60, height: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  dateDay: { color: COLORS.textLight, fontSize: 22, fontWeight: 'bold' },
  dateMonth: { color: COLORS.textSecondary, fontSize: 10, fontWeight: 'bold' },
  infoBox: { flex: 1, marginLeft: 15 },
  serviceName: { color: COLORS.textLight, fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeText: { color: COLORS.textSecondary, fontSize: 14 },
  cancelBtn: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  cancelBtnText: { color: '#F44336', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
  cancelInfoText: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' }
});