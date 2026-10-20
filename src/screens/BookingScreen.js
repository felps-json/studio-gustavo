import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  StatusBar, SafeAreaView, Alert, ActivityIndicator, Platform, Modal 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  format, addDays, isSameDay, isBefore, isSunday, isMonday, startOfMonth, endOfMonth 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { COLORS } from '../constants/theme';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

// --- CONFIGURAÇÕES DA BARBEARIA ---
const OPENING_HOUR = 9;  
const CLOSING_HOUR = 19; 
const INTERVAL = 30;     
const WORK_ON_SUNDAY = false; 
const WORK_ON_MONDAY = true;  

export default function BookingScreen({ route, navigation }) {
  const { user, profile } = useAuth();
  
  const { 
    totalDuration = 30, 
    selectedServices = [], 
    totalAmount = 0,
    isAdminMode = false, 
    clientData = null 
  } = route.params || {};

  // --- ESTADOS ---
  const [baseDate, setBaseDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState(new Date()); 
  const [selectedSlot, setSelectedSlot] = useState(null);
  
  const [monthAppointments, setMonthAppointments] = useState({});
  const [loading, setLoading] = useState(true);

  // DatePicker Nativo
  const [showDatePicker, setShowDatePicker] = useState(false);

  // --- 1. CARREGA DADOS DO MÊS INTEIRO (AGORA LENDO A DURAÇÃO) ---
  useEffect(() => {
    fetchMonthAvailability(baseDate);
  }, [baseDate]);

  const fetchMonthAvailability = async (dateRef) => {
    setLoading(true);
    try {
      const start = format(startOfMonth(dateRef), 'yyyy-MM-dd');
      const end = format(endOfMonth(addDays(dateRef, 60)), 'yyyy-MM-dd'); 

      // Busca só data, hora e duração dos horários ocupados (sem dados dos outros clientes)
      const { data, error } = await supabase.rpc('get_busy_slots', { p_start: start, p_end: end });

      if (error) throw error;

      const appointmentsByDay = {};
      
      data.forEach(app => {
        const safeDate = app.date.split('T')[0]; 
        const startTimeStr = app.time.substring(0, 5);
        const duration = app.duration || 30; // Se não tiver duração gravada, assume 30 min

        if (!appointmentsByDay[safeDate]) appointmentsByDay[safeDate] = [];

        // LÓGICA DE EXPANSÃO DE HORÁRIOS:
        // Transforma a hora inicial (ex: 09:00) em minutos totais (540)
        const startMins = parseInt(startTimeStr.split(':')[0]) * 60 + parseInt(startTimeStr.split(':')[1]);
        const slotsCount = Math.ceil(duration / INTERVAL); // Quantos blocos de 30 min ele ocupa?

        // Pinta como ocupado TODOS os blocos de 30 min que o serviço usa
        for (let i = 0; i < slotsCount; i++) {
            const currentMins = startMins + (i * INTERVAL);
            const h = Math.floor(currentMins / 60).toString().padStart(2, '0');
            const m = (currentMins % 60).toString().padStart(2, '0');
            appointmentsByDay[safeDate].push(`${h}:${m}`);
        }
      });

      setMonthAppointments(appointmentsByDay);
    } catch (error) {
      console.log("Erro ao buscar agenda:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. LÓGICA DE ENCAIXE INTELIGENTE ---
  const checkDayAvailability = useCallback((date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Bloqueios fixos
    if (isBefore(date, today)) return false;
    if (!WORK_ON_SUNDAY && isSunday(date)) return false;
    if (!WORK_ON_MONDAY && isMonday(date)) return false;

    const dateString = format(date, 'yyyy-MM-dd');
    const busySlots = monthAppointments[dateString] || [];

    const startMins = OPENING_HOUR * 60;
    const endMins = CLOSING_HOUR * 60;
    const slotsNeeded = Math.ceil(totalDuration / INTERVAL);

    const minutesToTime = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    for (let time = startMins; time < endMins; time += INTERVAL) {
        if (isSameDay(date, new Date())) {
           const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
           if (time <= nowMins) continue;
        }

        if (busySlots.includes(minutesToTime(time))) continue;

        let fits = true;
        for (let i = 0; i < slotsNeeded; i++) {
            const checkTime = time + (i * INTERVAL);
            if (checkTime >= endMins || busySlots.includes(minutesToTime(checkTime))) {
                fits = false;
                break;
            }
        }

        if (fits) return true; 
    }

    return false; 
  }, [monthAppointments, totalDuration]);

  // --- 3. GERA OS 7 DIAS DO CARROSSEL ---
  const nextDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(baseDate, i));
  }, [baseDate]);

  // --- 4. GERA OS SLOTS DO DIA SELECIONADO ---
  const availableSlotsForSelectedDay = useMemo(() => {
    if (!selectedDate || !checkDayAvailability(selectedDate)) {
        return { Morning: [], Afternoon: [], Evening: [] };
    }
    
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    const busySlots = monthAppointments[dateString] || [];
    const slots = [];
    const startMins = OPENING_HOUR * 60;
    const endMins = CLOSING_HOUR * 60;
    const slotsNeeded = Math.ceil(totalDuration / INTERVAL);

    const minutesToTime = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    for (let time = startMins; time < endMins; time += INTERVAL) {
        if (isSameDay(selectedDate, new Date())) {
           const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
           if (time <= nowMins) continue;
        }

        if (busySlots.includes(minutesToTime(time))) continue;

        let fits = true;
        for (let i = 0; i < slotsNeeded; i++) {
            const checkTime = time + (i * INTERVAL);
            if (checkTime >= endMins || busySlots.includes(minutesToTime(checkTime))) {
                fits = false;
                break;
            }
        }

        if (fits) slots.push(minutesToTime(time));
    }

    const groups = { Morning: [], Afternoon: [], Evening: [] };
    slots.forEach(t => {
      const h = parseInt(t.split(':')[0]);
      if (h < 12) groups.Morning.push(t);
      else if (h < 18) groups.Afternoon.push(t);
      else groups.Evening.push(t);
    });

    return groups;
  }, [selectedDate, monthAppointments, totalDuration, checkDayAvailability]);

  // --- AÇÕES ---
  const onDateChange = (event, date) => {
      if (Platform.OS === 'android') {
          setShowDatePicker(false);
      }
      
      if (date) {
          setBaseDate(date);     
          setSelectedDate(date); 
          setSelectedSlot(null);
      }
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedSlot) return;
    try {
        const dateString = format(selectedDate, 'yyyy-MM-dd');
        const serviceNames = selectedServices.map(s => s.title).join(' + ');
        const userIdToSave = isAdminMode && clientData ? clientData.id : user.id;
        const clientNameToSave = isAdminMode && clientData ? clientData.name : profile?.full_name;

        // GRAVA NO BANCO: duration incluída e regra de status corrigida
        const { error } = await supabase.from('appointments').insert({
            user_id: userIdToSave,
            client_name: clientNameToSave,
            service_names: serviceNames,
            date: dateString,
            time: selectedSlot,
            duration: totalDuration, 
            price: totalAmount,
            status: isAdminMode ? 'confirmed' : 'pending', 
            payment_method: 'local'
        });

        if (error) throw error;

        if (isAdminMode) {
            Alert.alert("Sucesso", "Agendamento realizado!", [{ text: "OK", onPress: () => navigation.navigate('AdminDashboard') }]);
        } else {
            navigation.navigate('Success');
        }
    } catch (error) {
        if (error?.message?.includes('HORARIO_OCUPADO')) {
            Alert.alert("Horário indisponível", "Esse horário acabou de ser reservado. Escolha outro.");
            setSelectedSlot(null);
            fetchMonthAvailability(baseDate);
        } else {
            Alert.alert("Erro", "Falha ao agendar. Tente novamente.");
        }
    }
  };

  const renderSlotGroup = (title, icon, slots) => {
    if (slots.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name={icon} size={18} color={COLORS.textSecondary} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <View style={styles.grid}>
          {slots.map((time) => (
            <TouchableOpacity 
              key={time} 
              onPress={() => setSelectedSlot(time)}
              style={[styles.slot, selectedSlot === time && styles.slotSelected]}
            >
              <Text style={[styles.slotText, selectedSlot === time && styles.slotTextSelected]}>{time}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back-ios" size={20} color={COLORS.textLight} style={{marginLeft: 6}} />
        </TouchableOpacity>
        
        <View style={{alignItems: 'center'}}>
            <Text style={styles.headerTitle}>ESCOLHER HORÁRIO</Text>
            {isAdminMode && <Text style={styles.adminLabel}>Para: {clientData?.name}</Text>}
        </View>
        
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.calendarBtn}>
            <MaterialIcons name="calendar-month" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        
        {/* CARROSSEL DE 7 DIAS */}
        <View style={styles.calendarContainer}>
            <View style={{flexDirection:'row', justifyContent:'space-between', paddingRight: 20, marginBottom: 15}}>
                <Text style={styles.monthTitle}>
                    {format(baseDate, "MMMM yyyy", { locale: ptBR })}
                </Text>
                {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {nextDays.map((date, index) => {
                const isSelected = isSameDay(selectedDate, date);
                const dayName = format(date, "EEE", { locale: ptBR }).toUpperCase().slice(0, 3);
                const dayNum = format(date, "dd");
                
                const isAvailable = checkDayAvailability(date);

                return (
                  <TouchableOpacity 
                    key={index} 
                    disabled={!isAvailable}
                    onPress={() => { setSelectedDate(date); setSelectedSlot(null); }}
                    style={[
                      styles.dayCard, 
                      isSelected && styles.dayCardSelected,
                      !isAvailable && styles.dayCardDisabled
                    ]}
                  >
                    <Text style={[styles.dayName, isSelected && {color: 'black'}, !isAvailable && {color: '#666'}]}>
                        {dayName}
                    </Text>
                    <Text style={[styles.dayNum, isSelected && {color: 'black'}, !isAvailable && {color: '#444'}]}>
                        {dayNum}
                    </Text>
                    {isAvailable && !isSelected && <View style={styles.availableDot} />}
                    {isSelected && <View style={styles.dot} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
        </View>

        {/* LISTA DE HORÁRIOS */}
        <View style={styles.slotsContainer}>
            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 40}} />
            ) : !checkDayAvailability(selectedDate) ? (
                <View style={styles.emptyState}>
                    <MaterialIcons name="event-busy" size={40} color="#333" />
                    <Text style={styles.emptyText}>Agenda indisponível para esta data.</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                        <Text style={{color: COLORS.primary, marginTop: 10, fontWeight: 'bold'}}>Buscar outra data</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    {renderSlotGroup('Manhã', 'wb-sunny', availableSlotsForSelectedDay.Morning)}
                    {renderSlotGroup('Tarde', 'wb-twilight', availableSlotsForSelectedDay.Afternoon)}
                    {renderSlotGroup('Noite', 'nights-stay', availableSlotsForSelectedDay.Evening)}
                </>
            )}
        </View>
      </ScrollView>

      {/* FOOTER DE CONFIRMAÇÃO */}
      {selectedSlot && (
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View>
              <Text style={styles.footerLabel}>Agendamento para</Text>
              <Text style={styles.footerDate}>
                  {format(selectedDate, "dd 'de' MMM", { locale: ptBR })} às {selectedSlot}
              </Text>
              <Text style={styles.footerServices}>
                R$ {totalAmount} • {totalDuration} min
              </Text>
            </View>
            <TouchableOpacity 
                style={[styles.btnConfirm, isAdminMode && {backgroundColor: '#4CAF50'}]} 
                onPress={handleConfirm}
            >
                <Text style={styles.btnConfirmText}>CONFIRMAR</Text>
                <MaterialIcons name="arrow-forward" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* MODAL DO CALENDÁRIO NATIVO */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 40, paddingBottom: 10, paddingHorizontal: 20 },
  headerTitle: { color: COLORS.textLight, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  adminLabel: { color: '#4CAF50', fontSize: 12, fontWeight: 'bold' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surfaceHighlight, borderRadius: 20 },
  calendarBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(212, 163, 115, 0.1)', borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary },
  
  calendarContainer: { marginTop: 20, marginBottom: 10 },
  monthTitle: { color: COLORS.textSecondary, fontSize: 14, fontWeight: 'bold', marginLeft: 20, textTransform: 'uppercase' },
  
  dayCard: { width: 65, height: 85, borderRadius: 16, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  dayCardSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayCardDisabled: { opacity: 0.4, backgroundColor: '#111', borderColor: 'transparent' },
  dayName: { color: COLORS.textSecondary, fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  dayNum: { color: COLORS.textLight, fontSize: 22, fontWeight: 'bold' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'black', marginTop: 4 },
  availableDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primary, marginTop: 4 },
  
  slotsContainer: { paddingHorizontal: 20, paddingTop: 10 },
  section: { marginBottom: 25 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: { width: '30%', paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  slotSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  slotText: { color: COLORS.textLight, fontWeight: '500', fontSize: 14 },
  slotTextSelected: { color: 'black', fontWeight: 'bold' },

  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: COLORS.textSecondary, marginTop: 15, fontSize: 14 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1A1A1A', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: {width: 0, height: -5}, shadowOpacity: 0.3, elevation: 20, borderTopWidth: 1, borderColor: '#333' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { color: COLORS.textSecondary, fontSize: 10, textTransform: 'uppercase', fontWeight: 'bold' },
  footerDate: { color: COLORS.textLight, fontSize: 16, fontWeight: 'bold', marginBottom: 2, textTransform: 'capitalize' },
  footerServices: { color: COLORS.primary, fontSize: 12, fontWeight: 'bold' },
  btnConfirm: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnConfirmText: { color: COLORS.white, fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },

  // --- ESTILOS DO MODAL DO CALENDÁRIO (iOS) ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#1E1E1E', borderRadius: 20, padding: 20, width: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  modalBtn: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  modalBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});