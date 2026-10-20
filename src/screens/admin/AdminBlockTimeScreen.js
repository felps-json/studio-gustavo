import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  Alert, StatusBar, ActivityIndicator, Platform, Modal 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, addDays, isSameDay, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { COLORS } from '../../constants/theme';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

const OPENING_HOUR = 9;
const CLOSING_HOUR = 19;
const INTERVAL = 30;

export default function AdminBlockTimeScreen({ navigation }) {
  const { user } = useAuth();
  
  // Agora o baseDate pode ser atualizado pelo calendário
  const [baseDate, setBaseDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slotsToBlock, setSlotsToBlock] = useState([]); 
  const [busySlots, setBusySlots] = useState([]);
  const [blockedEntries, setBlockedEntries] = useState([]); // Bloqueios já gravados ({ id, time })
  const [loading, setLoading] = useState(true);

  // DatePicker Nativo
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Gera os próximos 14 dias a partir da data base
  const nextDays = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => addDays(baseDate, i));
  }, [baseDate]);

  useEffect(() => {
    fetchDayAvailability(selectedDate);
    setSlotsToBlock([]); // Limpa a seleção ao mudar de dia
  }, [selectedDate]);

  const fetchDayAvailability = async (date) => {
    setLoading(true);
    try {
      const dateString = format(date, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('appointments')
        .select('id, time, duration, status')
        .eq('date', dateString)
        .not('status', 'in', '(cancelled,declined)');

      if (error) throw error;

      const occupied = [];
      const blocked = [];
      data.forEach(app => {
        if (app.status === 'blocked') {
            blocked.push({ id: app.id, time: app.time.substring(0, 5) });
        }

        const startTimeStr = app.time.substring(0, 5);
        const duration = app.duration || 30;
        
        const startMins = parseInt(startTimeStr.split(':')[0]) * 60 + parseInt(startTimeStr.split(':')[1]);
        const slotsCount = Math.ceil(duration / INTERVAL);

        for (let i = 0; i < slotsCount; i++) {
            const currentMins = startMins + (i * INTERVAL);
            const h = Math.floor(currentMins / 60).toString().padStart(2, '0');
            const m = (currentMins % 60).toString().padStart(2, '0');
            occupied.push(`${h}:${m}`);
        }
      });

      setBusySlots(occupied);
      setBlockedEntries(blocked.sort((a, b) => a.time.localeCompare(b.time)));
    } catch (error) {
      console.log("Erro ao buscar agenda para bloqueio:", error);
    } finally {
      setLoading(false);
    }
  };

  const availableSlots = useMemo(() => {
    if (loading) return [];
    
    const slots = [];
    const startMins = OPENING_HOUR * 60;
    const endMins = CLOSING_HOUR * 60;
    
    const now = new Date();
    const isToday = isSameDay(selectedDate, now);
    const currentMinsNow = now.getHours() * 60 + now.getMinutes();

    for (let time = startMins; time < endMins; time += INTERVAL) {
        if (isToday && time <= currentMinsNow) continue;

        const h = Math.floor(time / 60).toString().padStart(2, '0');
        const m = (time % 60).toString().padStart(2, '0');
        const timeString = `${h}:${m}`;

        if (!busySlots.includes(timeString)) {
            slots.push(timeString);
        }
    }
    return slots;
  }, [selectedDate, busySlots, loading]);

  const toggleSlot = (time) => {
    if (slotsToBlock.includes(time)) {
      setSlotsToBlock(slotsToBlock.filter(t => t !== time));
    } else {
      setSlotsToBlock([...slotsToBlock, time]);
    }
  };

  // --- LÓGICA DO CALENDÁRIO ---
  const onDateChange = (event, date) => {
      if (Platform.OS === 'android') {
          setShowDatePicker(false);
      }
      
      if (date) {
          setBaseDate(date);     // Pula o carrossel para a data escolhida
          setSelectedDate(date); // Carrega os horários dessa data
          setSlotsToBlock([]);   // Zera seleções pendentes
      }
  };

  const handleUnblock = (entry) => {
    Alert.alert(
      "Desbloquear Horário",
      `Liberar o horário das ${entry.time} para os clientes?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desbloquear",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', entry.id)
                .eq('status', 'blocked');

              if (error) throw error;
              fetchDayAvailability(selectedDate);
            } catch (error) {
              Alert.alert("Erro", "Falha ao desbloquear o horário.");
              console.log(error);
            }
          }
        }
      ]
    );
  };

  const handleBlockConfirm = async () => {
    if (slotsToBlock.length === 0) return;

    try {
        const dateString = format(selectedDate, 'yyyy-MM-dd');

        const inserts = slotsToBlock.map(time => ({
            user_id: user.id,
            client_name: 'Bloqueio de Agenda',
            service_names: 'Indisponível',
            date: dateString,
            time: time,
            duration: 30, 
            price: 0,
            status: 'blocked', 
            payment_method: 'none'
        }));

        const { error } = await supabase.from('appointments').insert(inserts);

        if (error) throw error;

        Alert.alert(
          "Sucesso", 
          `${slotsToBlock.length} horário(s) foram bloqueados com sucesso!`,
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );

    } catch (error) {
        Alert.alert("Erro", "Falha ao bloquear horários.");
        console.log(error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      {/* Header Híbrido */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back-ios" size={20} color={COLORS.textLight} style={{marginLeft: 6}} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>BLOQUEAR AGENDA</Text>
        
        {/* BOTÃO DO CALENDÁRIO MENSAL */}
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.calendarBtn}>
            <MaterialIcons name="calendar-month" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Seletor de Dia */}
        <View style={styles.calendarContainer}>
            <View style={{flexDirection:'row', justifyContent:'space-between', paddingRight: 20, marginBottom: 15}}>
                <Text style={styles.sectionTitle}>
                    {format(baseDate, "MMMM yyyy", { locale: ptBR })}
                </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {nextDays.map((day, index) => {
                  const isSelected = isSameDay(selectedDate, day);
                  const isPast = isBefore(day, new Date()) && !isSameDay(day, new Date());
                  
                  return (
                    <TouchableOpacity 
                        key={index} 
                        disabled={isPast}
                        onPress={() => setSelectedDate(day)}
                        style={[
                            styles.dayCard, 
                            isSelected && styles.dayCardSelected,
                            isPast && { opacity: 0.3 }
                        ]}
                    >
                        <Text style={[styles.dayName, isSelected && {color: 'black'}]}>
                            {format(day, 'EEE', {locale: ptBR}).toUpperCase().slice(0,3)}
                        </Text>
                        <Text style={[styles.dayNum, isSelected && {color: 'black'}]}>
                            {format(day, 'dd')}
                        </Text>
                    </TouchableOpacity>
                  )
              })}
            </ScrollView>
        </View>

        {/* Grade de Horários */}
        <View style={styles.slotsContainer}>
            <View style={styles.infoBox}>
                <MaterialIcons name="info-outline" size={20} color={COLORS.textSecondary} />
                <Text style={styles.infoText}>
                    Toque nos horários livres abaixo para <Text style={{color: '#F44336', fontWeight: 'bold'}}>bloqueá-los</Text>. Eles deixarão de aparecer para os clientes.
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 30}} />
            ) : (
                <View style={styles.grid}>
                    {availableSlots.length > 0 ? (
                        availableSlots.map((time) => {
                            const isSelected = slotsToBlock.includes(time);
                            return (
                                <TouchableOpacity 
                                    key={time} 
                                    onPress={() => toggleSlot(time)}
                                    style={[styles.slot, isSelected && styles.slotBlocked]}
                                >
                                    <Text style={[styles.slotText, isSelected && styles.slotTextBlocked]}>
                                        {time}
                                    </Text>
                                    {isSelected && (
                                        <View style={styles.blockedBadge}>
                                            <MaterialIcons name="block" size={12} color="white" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })
                    ) : (
                        <Text style={styles.emptyText}>Nenhum horário livre ou bloqueável neste dia.</Text>
                    )}
                </View>
            )}

            {/* Bloqueios já existentes (toque para desbloquear) */}
            {!loading && blockedEntries.length > 0 && (
                <View style={{ marginTop: 30 }}>
                    <Text style={[styles.sectionTitle, { marginLeft: 0, marginBottom: 15 }]}>Bloqueados neste dia</Text>
                    <View style={styles.grid}>
                        {blockedEntries.map((entry) => (
                            <TouchableOpacity
                                key={entry.id}
                                onPress={() => handleUnblock(entry)}
                                style={[styles.slot, styles.slotBlocked]}
                            >
                                <Text style={[styles.slotText, styles.slotTextBlocked]}>{entry.time}</Text>
                                <View style={styles.blockedBadge}>
                                    <MaterialIcons name="lock-open" size={12} color="white" />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={[styles.infoText, { marginTop: 10 }]}>Toque em um horário bloqueado para liberá-lo.</Text>
                </View>
            )}
        </View>

      </ScrollView>

      {/* Footer de Ação */}
      {slotsToBlock.length > 0 && (
          <View style={styles.footer}>
              <Text style={styles.footerText}>
                  Bloquear {slotsToBlock.length} horário(s) dia {format(selectedDate, 'dd/MM')}?
              </Text>
              <TouchableOpacity style={styles.blockBtn} onPress={handleBlockConfirm}>
                  <Text style={styles.btnText}>CONFIRMAR BLOQUEIO</Text>
              </TouchableOpacity>
          </View>
      )}

      {/* MODAL DO CALENDÁRIO NATIVO (COM TEMA ESCURO E BOTÃO PARA iOS) */}
      {showDatePicker && (
        Platform.OS === 'ios' ? (
            <Modal transparent={true} animationType="fade" visible={showDatePicker}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <DateTimePicker
                            value={baseDate}
                            mode="date"
                            display="inline"
                            themeVariant="dark" 
                            onChange={onDateChange}
                            minimumDate={new Date()} 
                        />
                        <TouchableOpacity 
                            style={styles.modalBtn} 
                            onPress={() => setShowDatePicker(false)}
                        >
                            <Text style={styles.modalBtnText}>CONCLUIR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        ) : (
            <DateTimePicker
                value={baseDate}
                mode="date"
                display="default"
                onChange={onDateChange}
                minimumDate={new Date()} 
            />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: COLORS.surface },
  headerTitle: { color: COLORS.textLight, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surfaceHighlight, borderRadius: 20 },
  calendarBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(212, 163, 115, 0.1)', borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary },
  
  calendarContainer: { marginTop: 20 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 14, fontWeight: 'bold', marginLeft: 20, textTransform: 'uppercase' },
  
  dayCard: { width: 60, height: 80, borderRadius: 12, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  dayCardSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayName: { color: COLORS.textSecondary, fontSize: 10, fontWeight: 'bold' },
  dayNum: { color: COLORS.textLight, fontSize: 20, fontWeight: 'bold' },

  slotsContainer: { padding: 20 },
  infoBox: { flexDirection: 'row', gap: 10, marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8 },
  infoText: { color: COLORS.textSecondary, fontSize: 12, flex: 1, lineHeight: 18 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  
  slot: { width: '30%', height: 50, borderRadius: 8, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#4CAF50' }, 
  slotText: { color: COLORS.textLight, fontWeight: 'bold' },

  slotBlocked: { backgroundColor: 'rgba(244, 67, 54, 0.2)', borderColor: '#F44336' },
  slotTextBlocked: { color: '#F44336' },
  blockedBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#F44336', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },

  emptyText: { color: COLORS.textSecondary, width: '100%', textAlign: 'center', marginTop: 20 },

  footer: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#1A1A1A', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: -5}, shadowOpacity: 0.5, elevation: 10 },
  footerText: { color: COLORS.textLight, marginBottom: 15, fontWeight: 'bold', fontSize: 16 },
  blockBtn: { backgroundColor: '#F44336', width: '100%', height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', letterSpacing: 1 },

  // --- ESTILOS DO MODAL DO CALENDÁRIO (iOS) ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#1E1E1E', borderRadius: 20, padding: 20, width: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  modalBtn: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  modalBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});