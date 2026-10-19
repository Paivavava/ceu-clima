# Céu · Previsão do tempo

Site de clima responsivo feito com **HTML, CSS e JavaScript puro**, sem build e sem dependências.
Busque qualquer cidade do mundo e veja temperatura, condições, próximas 24 horas, previsão de 7 dias,
qualidade do ar e detalhes como vento, umidade, UV e nascer/pôr do sol.

**Site publicado:** https://paivavava.github.io/ceu-clima/

## Destaques

- Busca com sugestões (nome, estado, país), destaque do termo e navegação por teclado
  (`↑` `↓` `Enter` `Esc`), além do atalho `/` para focar o campo.
- Clima atual com sensação térmica, máxima/mínima, umidade, ponto de orvalho, vento com direção e
  rajadas, pressão, índice UV, chance de chuva, nascer e pôr do sol.
- Próximas 24 horas em faixa horizontal e próximos 7 dias com barras de amplitude térmica.
- Cenário animado por condição e horário: sol, lua, estrelas, nuvens, chuva, neve, nevoeiro e
  relâmpagos, tudo em CSS e com suporte a `prefers-reduced-motion`.
- Unidades °C/°F com conversão de temperatura e vento, preferência salva no `localStorage`.
- Geolocalização, memória da última cidade, skeleton de carregamento e mensagens de erro amigáveis.

## Como rodar

O projeto é 100% estático. Sirva a pasta com qualquer servidor HTTP:

```bash
python3 -m http.server 3000
```

Abra <http://localhost:3000>.

## APIs

Nenhuma chave de API é necessária. Os dados vêm da [Open-Meteo](https://open-meteo.com):

| Serviço | Uso |
| --- | --- |
| [Geocoding API](https://open-meteo.com/en/docs/geocoding-api) | Transforma o nome digitado em coordenadas |
| [Forecast API](https://open-meteo.com/en/docs) | Clima atual, hora a hora e 7 dias |
| [Air Quality API](https://open-meteo.com/en/docs/air-quality-api) | Índice europeu de qualidade do ar |

## Estrutura

```
index.html   marcação semântica e acessível
styles.css   tema glass, fundo animado, ícones e responsividade
app.js       busca, integração com as APIs, ícones SVG, unidades e renderização
```
