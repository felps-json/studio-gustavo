import React, { useState, useCallback } from 'react';
import { 
  View, Text, ScrollView, StyleSheet, TouchableOpacity, 
  StatusBar, Alert, ActivityIndicator 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { COLORS } from '../../constants/theme';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext'; 

export default function AdminAgendaScreen({ navigation }) {
  const { signOut } = useAuth();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('today');

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const headerDateText = format(new Date(), "'Hoje,' dd 'de' MMMM", { locale: ptBR });

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .in('status', ['pending', 'confirmed']) 
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) throw error;

      const formattedData = data.map(app => ({
        id: app.id,
        user_id: app.user_id, // Identifica de quem é o corte
        client: app.client_name || 'Cliente Sem Nome',
        service: app.service_names,
        date: app.date,
        time: app.time.substring(0, 5),
        price: app.price,
        status: app.status
      }));

      setAppointments(formattedData);
    } catch (error) {
      console.log("Erro ao buscar agenda:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAppointments();
    }, [])
  );

  const handleStatusChange = async (id, newStatus) => {
    try {
      // Atualiza a tela imediatamente (Optimistic UI)
      setAppointments(prev => prev.filter(a => {
          if (a.id === id) {
              if (newStatus === 'cancelled' || newStatus === 'completed' || newStatus === 'declined') return false; 
              a.status = newStatus;
          }
          return true;
      }));

      // --- FINALIZAR: status + pontos de fidelidade numa única operação no banco ---
      if (newStatus === 'completed') {
          const { data: earnedPoints, error } = await supabase.rpc('complete_appointment', { p_id: id });
          if (error) throw error;

          if (earnedPoints > 0) {
              Alert.alert("Finalizado!", `Corte faturado e o cliente ganhou +${earnedPoints} pontos!`);
          } else {
              Alert.alert("Finalizado!", "Corte faturado. (Nenhum ponto configurado para este serviço).");
          }
          return;
      }

      // Atualiza no banco de dados
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

    } catch (error) {
      Alert.alert("Erro", "Falha ao processar a requisição.");
      fetchAppointments(); // Reverte a tela em caso de erro
    }
  };

  const handleLogout = () => {
    Alert.alert(
        "Sair da Conta",
        "Deseja realmente sair do painel do barbeiro?",
        [
            { text: "Cancelar", style: "cancel" },
            { text: "Sair", onPress: signOut, style: 'destructive' }
        ]
    );
  };

  const pending = appointments.filter(a => a.status === 'pending');
  const confirmed = appointments.filter(a => a.status === 'confirmed' && (filter === 'all' || a.date === todayStr));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.surface} />
      
      <View style={styles.header}>
        <View>
            <Text style={styles.headerTitle}>Agenda Operacional</Text>
            <Text style={styles.dateDisplay}>{headerDateText}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <MaterialIcons name="logout" size={24} color="#FF6B6B" />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 15 }}>
        <TouchableOpacity 
            style={styles.blockActionBtn}
            onPress={() => navigation.navigate('AdminBlockTime')}
        >
            <MaterialIcons name="block" size={20} color="white" />
            <Text style={styles.blockActionText}>BLOQUEAR HORÁRIOS</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 50}} />
        ) : (
            <>
                {pending.length > 0 && (
                <View style={styles.alertSection}>
                    <View style={styles.alertHeader}>
                        <MaterialIcons name="notifications-active" size={20} color={COLORS.primary} />
                        <Text style={styles.alertTitle}>Requer Atenção ({pending.length})</Text>
                    </View>
                    
                    {pending.map(item => (
                    <View key={item.id} style={styles.requestCard}>
                        <View style={styles.requestRow}>
                            <View style={styles.dateBox}>
                                <Text style={styles.dateBoxDay}>{item.date.split('-')[2]}</Text>
                                <Text style={styles.dateBoxMonth}>MÊS</Text>
                            </View>
                            <View style={{flex: 1, paddingHorizontal: 10}}>
                                <Text style={styles.clientName}>{item.client}</Text>
                                <Text style={styles.serviceDetail}>{item.service} • {item.time}</Text>
                            </View>
                            <Text style={styles.priceTag}>R$ {item.price}</Text>
                        </View>
                        
                        <View style={styles.actions}>
                            <TouchableOpacity onPress={() => handleStatusChange(item.id, 'declined')} style={styles.btnDecline}>
                                <Text style={styles.btnTextDec}>Recusar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleStatusChange(item.id, 'confirmed')} style={styles.btnAccept}>
                                <Text style={styles.btnTextAcc}>Aceitar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    ))}
                </View>
                )}

                <View style={styles.filterRow}>
                    <Text style={styles.sectionTitle}>Próximos Cortes</Text>
                    <View style={styles.tabs}>
                        <TouchableOpacity onPress={() => setFilter('today')}>
                            <Text style={[styles.tab, filter==='today' && styles.activeTab]}>Hoje</Text>
                        </TouchableOpacity>
                        <Text style={{color:'#333'}}>|</Text>
                        <TouchableOpacity onPress={() => setFilter('all')}>
                            <Text style={[styles.tab, filter==='all' && styles.activeTab]}>Todos</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {confirmed.length === 0 ? (
                    <Text style={styles.empty}>Nenhum corte confirmado para este período.</Text>
                ) : (
                    confirmed.map(item => (
                    <View key={item.id} style={styles.apptCard}>
                        <Text style={styles.timeBig}>{item.time}</Text>
                        <View style={styles.apptLine} />
                        <View style={{flex: 1}}>
                            <Text style={styles.apptClient}>{item.client}</Text>
                            <Text style={styles.apptService}>{item.service}</Text>
                            {filter === 'all' && (
                                <Text style={styles.apptDate}>
                                    {format(new Date(item.date + 'T00:00:00'), "dd 'de' MMM", { locale: ptBR })}
                                </Text>
                            )}
                        </View>
                        
                        <View style={styles.apptActions}>
                            <TouchableOpacity onPress={() => handleStatusChange(item.id, 'cancelled')} style={styles.iconBtn}>
                                <MaterialIcons name="close" size={22} color="#F44336" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleStatusChange(item.id, 'completed')} style={[styles.iconBtn, {backgroundColor: 'rgba(76, 175, 80, 0.1)'}]}>
                                <MaterialIcons name="check" size={22} color="#4CAF50" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    ))
                )}
            </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: COLORS.surface },
  headerTitle: { color: COLORS.textLight, fontSize: 20, fontWeight: 'bold' },
  dateDisplay: { color: COLORS.primary, fontSize: 14, fontWeight: 'bold', marginTop: 4, textTransform: 'capitalize' },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(244, 67, 54, 0.1)', justifyContent: 'center', alignItems: 'center' },
  blockActionBtn: { backgroundColor: '#1E1E1E', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 8, gap: 8, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed' },
  blockActionText: { color: COLORS.textSecondary, fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
  alertSection: { marginBottom: 30 },
  alertHeader: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'center' },
  alertTitle: { color: COLORS.primary, fontWeight: 'bold', fontSize: 16 },
  requestCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: COLORS.primary },
  requestRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  dateBox: { backgroundColor: '#333', borderRadius: 8, padding: 8, alignItems: 'center', width: 50 },
  dateBoxDay: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  dateBoxMonth: { color: '#ccc', fontSize: 10 },
  clientName: { color: COLORS.textLight, fontWeight: 'bold', fontSize: 16 },
  serviceDetail: { color: COLORS.textSecondary, fontSize: 14, marginTop: 2 },
  priceTag: { color: COLORS.primary, fontWeight: 'bold', fontSize: 16 },
  actions: { flexDirection: 'row', gap: 10 },
  btnDecline: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#F44336', alignItems: 'center' },
  btnAccept: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#4CAF50', alignItems: 'center' },
  btnTextDec: { color: '#F44336', fontWeight: 'bold' },
  btnTextAcc: { color: 'white', fontWeight: 'bold' },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: COLORS.textLight, fontSize: 18, fontWeight: 'bold' },
  tabs: { flexDirection: 'row', gap: 10 },
  tab: { color: COLORS.textSecondary, fontWeight: 'bold' },
  activeTab: { color: COLORS.textLight },
  apptCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: 15, borderRadius: 12, marginBottom: 10 },
  timeBig: { color: COLORS.textLight, fontSize: 20, fontWeight: 'bold', width: 60 },
  apptLine: { width: 2, height: '100%', backgroundColor: COLORS.surfaceHighlight, marginRight: 15 },
  apptClient: { color: COLORS.textLight, fontSize: 16, fontWeight: 'bold' },
  apptService: { color: COLORS.textSecondary, fontSize: 14 },
  apptDate: { color: COLORS.primary, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  apptActions: { flexDirection: 'row', gap: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(76, 175, 80, 0.1)' },
  empty: { color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 20 }
});