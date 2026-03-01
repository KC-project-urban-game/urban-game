# Wdrożenie na Azure – Krok po kroku

Przewodnik opisuje pełne wdrożenie aplikacji **Scavenger Hunt** na platformie Azure:

| Warstwa | Usługa Azure |
|---------|-------------|
| Frontend (React/Vite) | Azure Static Web Apps |
| Backend (Node.js/Express) | Azure App Service (Linux) |
| Baza danych | Azure Cosmos DB for MongoDB |

---

## Wymagania wstępne

- Konto Azure (darmowe konto: <https://azure.microsoft.com/free>)
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) zainstalowane lokalnie
- Node.js 20 LTS
- Konto GitHub z tym repozytorium

Logowanie do Azure CLI:

```bash
az login
az account show   # sprawdź aktywną subskrypcję
```

---

## 1. Grupa zasobów

Wszystkie zasoby umieść w jednej grupie (ułatwia zarządzanie i usuwanie):

```bash
az group create \
  --name rg-scavenger-hunt \
  --location polandcentral
```

> Możesz wybrać inną lokalizację, np. `westeurope`. Sprawdź dostępność usług:
> `az account list-locations --output table`

---

## 2. Azure Cosmos DB for MongoDB

### 2.1 Utwórz konto Cosmos DB

```bash
az cosmosdb create \
  --resource-group rg-scavenger-hunt \
  --name cosmos-scavenger-hunt \
  --kind MongoDB \
  --server-version 6.0 \
  --default-consistency-level Session \
  --locations regionName=polandcentral failoverPriority=0 isZoneRedundant=false
```

> Tworzenie konta trwa ~5–10 minut.

### 2.2 Utwórz bazę danych

```bash
az cosmosdb mongodb database create \
  --resource-group rg-scavenger-hunt \
  --account-name cosmos-scavenger-hunt \
  --name scavenger-hunt
```

### 2.3 Pobierz connection string

```bash
az cosmosdb keys list \
  --resource-group rg-scavenger-hunt \
  --name cosmos-scavenger-hunt \
  --type connection-strings \
  --query "connectionStrings[?description=='Primary MongoDB Connection String'].connectionString" \
  --output tsv
```

Zapisz wynik – będzie potrzebny w kroku 3.

---

## 3. Azure App Service – Backend

### 3.1 Utwórz plan App Service

```bash
az appservice plan create \
  --resource-group rg-scavenger-hunt \
  --name plan-scavenger-hunt \
  --is-linux \
  --sku B1
```

> Tier **B1** (Basic) jest wystarczający na start. Możesz zmienić na `S1` lub `P1V3` dla produkcji.

### 3.2 Utwórz aplikację webową

```bash
az webapp create \
  --resource-group rg-scavenger-hunt \
  --plan plan-scavenger-hunt \
  --name backend-scavenger-hunt \
  --runtime "NODE:20-lts" \
  --startup-file "node server.js"
```

> Nazwa `backend-scavenger-hunt` musi być **unikalna globalnie** (stanie się częścią URL:
> `https://backend-scavenger-hunt.azurewebsites.net`).

### 3.3 Skonfiguruj zmienne środowiskowe

Zastąp `<CONNECTION_STRING>` wartością z kroku 2.3 oraz ustaw własny `JWT_SECRET` (min. 32 znaki):

```bash
az webapp config appsettings set \
  --resource-group rg-scavenger-hunt \
  --name backend-scavenger-hunt \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    AZURE_COSMOS_CONNECTIONSTRING="<CONNECTION_STRING>" \
    JWT_SECRET="<min-32-znakowy-tajny-klucz>" \
    ADMIN_SETUP_KEY="<tajny-klucz-admina>" \
    CLIENT_URL="https://<twoja-domena>.azurestaticapps.net" \
    WEBSITE_NODE_DEFAULT_VERSION="~20"
```

> Azure App Service na Linuksie używa domyślnie portu **8080** – upewnij się,
> że `PORT=8080` jest ustawiony (aplikacja czyta `process.env.PORT`).

### 3.4 Pobierz Publish Profile (potrzebny do CI/CD)

```bash
az webapp deployment list-publishing-profiles \
  --resource-group rg-scavenger-hunt \
  --name backend-scavenger-hunt \
  --xml \
  --output tsv > backend-publish-profile.xml
```

Zawartość pliku `backend-publish-profile.xml` wklej jako sekret
`AZURE_WEBAPP_PUBLISH_PROFILE` w ustawieniach repozytorium GitHub
(**Settings → Secrets and variables → Actions → New repository secret**).

Ustaw też zmienną repozytorium `AZURE_WEBAPP_NAME`:
**Settings → Variables → Actions → New repository variable**:
```
Name:  AZURE_WEBAPP_NAME
Value: backend-scavenger-hunt
```

> **Bezpieczeństwo:** Nie commituj pliku `backend-publish-profile.xml`.
> Usuń go po dodaniu do GitHub:
> ```bash
> rm backend-publish-profile.xml
> ```

---

## 4. Azure Static Web Apps – Frontend

### 4.1 Utwórz zasób Static Web Apps

```bash
az staticwebapp create \
  --resource-group rg-scavenger-hunt \
  --name swa-scavenger-hunt \
  --source https://github.com/<TWOJ_GITHUB_ORG>/urban-game \
  --branch main \
  --app-location "frontend" \
  --output-location "dist" \
  --login-with-github
```

> Polecenie otworzy przeglądarkę w celu autoryzacji GitHub. Po zakończeniu
> token `AZURE_STATIC_WEB_APPS_API_TOKEN` zostanie automatycznie dodany
> jako sekret repozytorium.

Jeśli wolisz dodać token ręcznie:

```bash
# Pobierz token wdrożenia
az staticwebapp secrets list \
  --resource-group rg-scavenger-hunt \
  --name swa-scavenger-hunt \
  --query "properties.apiKey" \
  --output tsv
```

Wklej wynik jako sekret `AZURE_STATIC_WEB_APPS_API_TOKEN` w GitHub.

### 4.2 Ustaw zmienną VITE_API_URL w GitHub

Ustaw zmienną repozytorium `VITE_API_URL`:
**Settings → Variables → Actions → New repository variable**:
```
Name:  VITE_API_URL
Value: https://backend-scavenger-hunt.azurewebsites.net/api
```

> Vite wbudowuje tę wartość w bundle podczas budowania.
> Zmienna musi być dostępna **w czasie budowania**, nie w czasie działania aplikacji.

### 4.3 Skonfiguruj CORS w backendzie

Dodaj adres frontendowej aplikacji do zmiennej `CLIENT_URL`:

```bash
# Pobierz URL Static Web Apps
az staticwebapp show \
  --resource-group rg-scavenger-hunt \
  --name swa-scavenger-hunt \
  --query "defaultHostname" \
  --output tsv
```

Zaktualizuj `CLIENT_URL` w konfiguracji App Service:

```bash
az webapp config appsettings set \
  --resource-group rg-scavenger-hunt \
  --name backend-scavenger-hunt \
  --settings CLIENT_URL="https://<wynik-poprzedniego-polecenia>"
```

---

## 5. CI/CD – GitHub Actions

Repozytorium zawiera gotowe workflow:

| Plik | Akcja |
|------|-------|
| `.github/workflows/deploy-backend.yml` | Deploy backendu → Azure App Service |
| `.github/workflows/deploy-frontend.yml` | Build + deploy frontendu → Azure Static Web Apps |

### Wymagane sekrety i zmienne w GitHub

Upewnij się, że poniższe wartości są skonfigurowane:

**Sekrety** (`Settings → Secrets and variables → Actions`):

| Nazwa | Skąd |
|-------|------|
| `AZURE_WEBAPP_PUBLISH_PROFILE` | Krok 3.4 |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Krok 4.1 |

**Zmienne** (`Settings → Variables → Actions`):

| Nazwa | Wartość |
|-------|---------|
| `AZURE_WEBAPP_NAME` | `backend-scavenger-hunt` |
| `VITE_API_URL` | `https://backend-scavenger-hunt.azurewebsites.net/api` |

### Pierwsze wdrożenie

Po skonfigurowaniu sekretów/zmiennych wypchnij zmiany na gałąź `main`:

```bash
git push origin main
```

Lub uruchom workflow ręcznie w zakładce **Actions** na GitHub.

---

## 6. Weryfikacja wdrożenia

### 6.1 Backend

```bash
# Health check
curl https://backend-scavenger-hunt.azurewebsites.net/api/health
# Oczekiwana odpowiedź: {"status":"ok"}
```

### 6.2 Frontend

Otwórz w przeglądarce:
```
https://<twoja-domena>.azurestaticapps.net
```

Zaloguj się kontem administratora, używając danych logowania, które samodzielnie skonfigurujesz podczas wdrażania backendu (np. poprzez zmienne środowiskowe w Azure App Service, takie jak `ADMIN_USERNAME` i `ADMIN_PASSWORD`).

> **Ważne:** Ustaw silne, unikalne hasło administratora, przechowuj je w bezpiecznym miejscu i regularnie je zmieniaj. Nie stosuj domyślnych ani przykładowych haseł z dokumentacji.
### 6.3 Sprawdź logi backendu

```bash
az webapp log tail \
  --resource-group rg-scavenger-hunt \
  --name backend-scavenger-hunt
```

---

## 7. Własna domena (opcjonalnie)

### Frontend (Static Web Apps)

```bash
az staticwebapp hostname set \
  --resource-group rg-scavenger-hunt \
  --name swa-scavenger-hunt \
  --hostname twoja-domena.pl
```

Dodaj rekord CNAME/TXT u swojego dostawcy DNS zgodnie z instrukcjami z portalu Azure.

### Backend (App Service)

```bash
az webapp config hostname add \
  --resource-group rg-scavenger-hunt \
  --webapp-name backend-scavenger-hunt \
  --hostname api.twoja-domena.pl
```

Certyfikat TLS jest automatycznie wystawiany przez Azure dla Static Web Apps.
Dla App Service użyj zarządzanych certyfikatów:

```bash
az webapp config ssl create \
  --resource-group rg-scavenger-hunt \
  --name backend-scavenger-hunt \
  --hostname api.twoja-domena.pl
```

---

## 8. Skalowanie i optymalizacja (opcjonalnie)

### Skalowanie App Service

```bash
# Zmiana tieru (np. na Standard S2)
az appservice plan update \
  --resource-group rg-scavenger-hunt \
  --name plan-scavenger-hunt \
  --sku S2

# Autoskalowanie horyzontalne (min 1, max 3 instancje)
az monitor autoscale create \
  --resource-group rg-scavenger-hunt \
  --resource backend-scavenger-hunt \
  --resource-type Microsoft.Web/sites \
  --name autoscale-backend \
  --min-count 1 \
  --max-count 3 \
  --count 1
```

### Throughput Cosmos DB

Domyślnie Cosmos DB tworzy kontenery z **autoskalowaniem (400–4000 RU/s)**.
Możesz zmienić limit w portalu Azure: **Cosmos DB → Data Explorer → Scale**.

---

## 9. Usunięcie wszystkich zasobów

Aby usunąć wszystkie zasoby i zatrzymać naliczanie kosztów:

```bash
az group delete --name rg-scavenger-hunt --yes --no-wait
```

---

## Podsumowanie architektury

```
┌─────────────────────────────────────────────────────────┐
│                        Azure                            │
│                                                         │
│  ┌──────────────────────┐   ┌──────────────────────┐   │
│  │  Static Web Apps     │   │   App Service (B1)   │   │
│  │  (React/Vite SPA)    │──▶│   Node.js 20 LTS     │   │
│  │  swa-scavenger-hunt  │   │  backend-scavenger.. │   │
│  └──────────────────────┘   └──────────┬───────────┘   │
│                                         │               │
│                              ┌──────────▼───────────┐  │
│                              │  Cosmos DB (MongoDB) │  │
│                              │  cosmos-scavenger-.. │  │
│                              └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

| Komponent | URL |
|-----------|-----|
| Frontend | `https://<id>.azurestaticapps.net` |
| Backend API | `https://backend-scavenger-hunt.azurewebsites.net/api` |
| Health check | `https://backend-scavenger-hunt.azurewebsites.net/api/health` |
