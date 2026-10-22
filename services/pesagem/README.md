# Bonança · Pesagem

Microserviço interno do módulo **Pesagem e desempenho animal**, adaptado do módulo recebido. O domínio preserva animais, sessões, pesagens, grupos coletivos, grupos comuns, listas, campos, linhagem, importação CSV e métricas de GMD.

## Contrato interno

O serviço não publica porta para a internet. O app Bonança chama:

- `GET /api/health` sem autenticação, somente para healthcheck;
- `GET /api/state` com o estado operacional da organização;
- `GET /api/animal?id=...` para ficha e histórico;
- `GET /api/session?id=...` para detalhe da sessão;
- `POST /api/commands` para comandos do domínio.

Toda chamada protegida exige `Authorization: Bearer $PESAGEM_SERVICE_TOKEN`, `X-Bonanca-Organization` e `X-Bonanca-User`. O banco SQLite é separado por hash da organização dentro do volume `pesagem_data`; nenhum cabeçalho enviado pelo navegador é aceito como autenticação porque somente o app interno conhece o token.

## Limites

O módulo não simula protocolo de balança física. Pesagens manuais e eventos recebidos por integração futura são mantidos separados; homologação de fabricante, firmware e transporte continua necessária.
