-- Confirmação atômica de uma importação de extrato.
-- security invoker: as políticas de RLS continuam valendo para quem chama.
create or replace function public.confirmar_importacao(
  p_casa uuid,
  p_membro uuid,
  p_arquivo text,
  p_perfil text,
  p_linhas jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_imp uuid;
  l jsonb;
  v_tr uuid;
  v_acao text;
  v_valor bigint;
  v_data date;
  v_n int;
  c_novo int := 0;
  c_vincular int := 0;
  c_racha int := 0;
  c_ignorar int := 0;
  c_dup int := 0;
  v_cont jsonb;
begin
  if not public.eh_membro(p_casa) then
    raise exception 'Sem permissão para esta casa';
  end if;

  insert into importacoes (casa_id, membro_id, arquivo, perfil)
  values (p_casa, p_membro, p_arquivo, p_perfil)
  returning id into v_imp;

  for l in select * from jsonb_array_elements(p_linhas) loop
    v_acao := l->>'acao';
    v_valor := (l->>'valor')::bigint;
    v_data := (l->>'data')::date;

    insert into transacoes_importadas (casa_id, importacao_id, hash, data, descricao, valor, acao)
    values (p_casa, v_imp, l->>'hash', v_data, l->>'descricao', v_valor, v_acao)
    on conflict (casa_id, hash) do nothing
    returning id into v_tr;

    if v_tr is null then
      c_dup := c_dup + 1;
      continue;
    end if;

    if v_acao = 'novo' then
      insert into ocorrencias (
        casa_id, origem_tipo, descricao, tipo, dono_membro_id, categoria_id,
        valor_previsto, valor_real, vencimento, pago_em, status, transacao_importada_id
      ) values (
        p_casa, 'pontual', l->>'descricao',
        case when v_valor >= 0 then 'entrada' else 'saida' end,
        nullif(l->>'dono_membro_id', '')::uuid, nullif(l->>'categoria_id', '')::uuid,
        abs(v_valor), abs(v_valor), v_data, v_data, 'pago', v_tr
      );
      c_novo := c_novo + 1;
    elsif v_acao = 'vincular' then
      update ocorrencias
      set status = 'pago', valor_real = abs(v_valor), pago_em = v_data, transacao_importada_id = v_tr
      where id = (l->>'vinculo_id')::uuid and casa_id = p_casa and status = 'pendente';
      get diagnostics v_n = row_count;
      if v_n = 0 then
        raise exception 'O lançamento escolhido para vincular "%" não está mais pendente. Atualize a prévia.', l->>'descricao';
      end if;
      c_vincular := c_vincular + 1;
    elsif v_acao = 'racha' then
      insert into racha_movimentos (casa_id, data, tipo, sentido, valor, descricao, transacao_importada_id)
      values (
        p_casa, v_data, coalesce(nullif(l->>'racha_tipo', ''), 'outro'),
        case when v_valor >= 0 then 'entrada' else 'saida' end,
        abs(v_valor), l->>'descricao', v_tr
      );
      c_racha := c_racha + 1;
    else
      c_ignorar := c_ignorar + 1;
    end if;

    -- Regra aprendida: mesma ação/categoria nas próximas importações.
    if coalesce((l->>'aprender')::boolean, false) and v_acao <> 'vincular' and coalesce(l->>'padrao', '') <> '' then
      insert into regras_importacao (casa_id, padrao, acao, categoria_id, dono_membro_id, racha_tipo, atualizado_em)
      values (
        p_casa, l->>'padrao', v_acao, nullif(l->>'categoria_id', '')::uuid,
        nullif(l->>'dono_membro_id', '')::uuid, nullif(l->>'racha_tipo', ''), now()
      )
      on conflict (casa_id, padrao) do update
      set acao = excluded.acao,
          categoria_id = excluded.categoria_id,
          dono_membro_id = excluded.dono_membro_id,
          racha_tipo = excluded.racha_tipo,
          atualizado_em = now();
    end if;
  end loop;

  v_cont := jsonb_build_object(
    'novo', c_novo, 'vincular', c_vincular, 'racha', c_racha, 'ignorar', c_ignorar, 'duplicadas', c_dup
  );
  update importacoes set contagens = v_cont where id = v_imp;
  return v_cont;
end;
$$;

revoke all on function public.confirmar_importacao(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.confirmar_importacao(uuid, uuid, text, text, jsonb) to authenticated;
