# Margem — revistas de moda

## Publicar no Vercel com Neon

1. Crie um banco PostgreSQL no Neon e execute todo o conteúdo de `schema.sql` no SQL Editor.
2. Envie este projeto para um repositório GitHub e importe o repositório no Vercel.
3. Em **Settings → Environment Variables** no Vercel, configure:
   - `DATABASE_URL`: string de conexão do Neon.
   - `ADMIN_INITIAL_USERNAME`: usuário inicial do ADM (por padrão, `edcarlos`).
   - `ADMIN_INITIAL_PASSWORD`: senha inicial forte, com pelo menos 12 caracteres.
4. Faça um novo deploy. No primeiro envio do formulário de login, o sistema cria a conta ADM no banco. Entre pelo botão **Painel ADM** e altere a senha na área de segurança.
5. Depois que a conta ADM for criada, `ADMIN_INITIAL_PASSWORD` pode ser removida do Vercel; o sistema passa a usar a credencial armazenada no banco.

Não publique o arquivo `.env` nem compartilhe `DATABASE_URL` ou a senha inicial. O `.gitignore` já protege arquivos `.env` locais.

`start.ps1` continua disponível apenas para desenvolvimento local; o site publicado no Vercel usa as funções em `api/` e não precisa dele.
