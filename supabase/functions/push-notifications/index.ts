import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // 1. Recebe o aviso do Banco de Dados
    const payload = await req.json()
    const { type, record, old_record } = payload

    // 2. Conecta no Supabase usando chaves de administrador
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let pushToken = ''
    let title = ''
    let body = ''

    // =================================================================
    // CENA 1: CLIENTE FEZ UM NOVO AGENDAMENTO (AVISAR O ADMIN)
    // =================================================================
    if (type === 'INSERT' && record.status !== 'blocked') { // Bloqueio de agenda não é pedido de cliente
      const { data: adminData } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('role', 'admin')
        .not('push_token', 'is', null)
        .limit(1)
        .single()

      if (adminData?.push_token) {
        pushToken = adminData.push_token
        title = 'Novo Agendamento! ✂️'
        body = `${record.client_name} pediu um horário dia ${record.date.split('-').reverse().slice(0, 2).join('/')} às ${record.time.substring(0, 5)}.`
      }
    } 
    // =================================================================
    // CENA 2: GUSTAVO ACEITOU OU RECUSOU (AVISAR O CLIENTE)
    // =================================================================
    else if (type === 'UPDATE') {
      // Só avisa se o status realmente mudou para confirmado ou recusado
      if (record.status !== old_record?.status && (record.status === 'confirmed' || record.status === 'declined')) {
        const { data: clientData } = await supabase
          .from('profiles')
          .select('push_token')
          .eq('id', record.user_id)
          .single()

        if (clientData?.push_token) {
          pushToken = clientData.push_token
          const firstName = record.client_name.split(' ')[0]
          const dateBr = record.date.split('-').reverse().slice(0, 2).join('/')
          
          if (record.status === 'confirmed') {
            title = 'Horário Confirmado! ✂️'
            body = `Fala ${firstName}! Gustavo confirmou seu corte dia ${dateBr} às ${record.time.substring(0, 5)}. Te esperamos lá!`
          } else {
            title = 'Aviso sobre seu horário ⚠️'
            body = `Fala ${firstName}, infelizmente não poderemos te atender dia ${dateBr} às ${record.time.substring(0, 5)}.`
          }
        }
      }
    }

    // 3. Dispara a notificação final pelo servidor da Expo
    if (pushToken && title && body) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: pushToken,
          sound: 'default',
          title: title,
          body: body,
        })
      })
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})