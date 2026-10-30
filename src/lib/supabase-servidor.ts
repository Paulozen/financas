// Cliente Supabase do servidor, com a sessão do usuário (cookies). RLS continua valendo.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServidor() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (lista) => {
        for (const { name, value, options } of lista) cookieStore.set(name, value, options);
      },
    },
  });
}
