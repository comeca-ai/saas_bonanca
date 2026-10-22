# Bonança · Balança Misturadora

Microserviço interno de alimentação animal, adaptado do módulo recebido. Mantém o domínio de máquinas, ingredientes, receitas versionadas, currais, operadores, fornecedores, batidas, estoque, sobras, ordenha e indicadores.

## Contrato interno

O serviço expõe apenas a rede Docker interna e exige `Authorization: Bearer $BALANCA_SERVICE_TOKEN`, `X-Bonanca-Organization` e `X-Bonanca-User` em todos os endpoints, exceto `GET /api/health`.

Os registros são isolados por organização no SQLite persistente do volume `balanca_data`. A chave de idempotência da conclusão de batida também é composta pela organização. O app Bonança é o único componente autorizado a encaminhar chamadas do usuário.

Endpoints preservados/adaptados: `/api/catalog`, cadastros, `/api/batches`, `/api/batches/:id/complete`, `/api/batches/:id/cancel`, `/api/stock`, `/api/movements`, `/api/refusals`, `/api/milking`, `/api/dashboard`, `/api/audit` e `/api/sync`.

`/api/sync` continua informando que não há adaptador físico homologado. A integração não simula leitura de equipamento, ACK, Bluetooth, serial, TCP ou nuvem do fabricante.
