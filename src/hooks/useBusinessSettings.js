import { useEffect, useState } from 'react';

import { DEFAULT_SETTINGS } from '../constants/business';
import { supabase } from '../services/supabase';

// Lê as configurações da barbearia (horários, prazo de cancelamento) do banco.
export function useBusinessSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    supabase
      .from('business_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (error) console.log("Erro ao buscar configurações:", error);
        else if (data) setSettings({ ...DEFAULT_SETTINGS, ...data });
      });
  }, []);

  return settings;
}
