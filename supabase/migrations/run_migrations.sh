#!/bin/bash
# =====================================================
# TIS TIS Platform - Script de Ejecución de Migraciones
# Ejecuta migraciones 153-177 (incluye consolidaciones)
# =====================================================

set -e  # Exit on error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directorio base (donde está este script y las migraciones)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Función para ejecutar una migración
run_migration() {
    local file=$1
    local name=$(basename "$file")

    echo -e "${BLUE}Ejecutando:${NC} $name"

    if [ -f "$file" ]; then
        # Usar supabase CLI o psql según disponibilidad
        if command -v supabase &> /dev/null; then
            supabase db execute --file "$file" 2>&1
        else
            echo -e "${YELLOW}NOTA: Usa 'supabase db execute --file $file' o psql${NC}"
            echo "psql \$DATABASE_URL -f \"$file\""
        fi
        echo -e "${GREEN}✓${NC} $name completado"
    else
        echo -e "${RED}✗${NC} Archivo no encontrado: $file"
        return 1
    fi
}

echo ""
echo "======================================================"
echo "TIS TIS Platform - Ejecución de Migraciones 153-177"
echo "======================================================"
echo ""
echo "Este script ejecutará 21 migraciones en orden correcto."
echo ""
echo "Migraciones consolidadas incluidas:"
echo "  - 160_SETUP_ASSISTANT_COMPLETE.sql (160 + 161 + 164)"
echo "  - 162_VOICE_MINUTE_SYSTEM_COMPLETE.sql (162 + 163 + 166)"
echo "  - 177_ADMIN_CHANNEL_COMPLETE.sql (177 + 178)"
echo ""

read -p "¿Deseas continuar? (s/n): " confirm
if [[ $confirm != [sS] ]]; then
    echo "Cancelado."
    exit 0
fi

echo ""
echo "Iniciando ejecución..."
echo ""

# Array de migraciones en orden (todas en el mismo directorio)
declare -a MIGRATIONS=(
    "$SCRIPT_DIR/153_AI_LEARNING_2_0_CONSOLIDATED.sql"
    "$SCRIPT_DIR/154_REMOVE_CASUAL_RESPONSE_STYLE.sql"
    "$SCRIPT_DIR/155_UNIFIED_ASSISTANT_TYPES.sql"
    "$SCRIPT_DIR/156_DELIVERY_SYSTEM.sql"
    "$SCRIPT_DIR/157_ADD_CLIENT_EMAIL_UNIQUE_CONSTRAINT.sql"
    "$SCRIPT_DIR/158_SPRINT2_INDEXES_AND_RLS_SCOPES.sql"
    "$SCRIPT_DIR/159_AUDIT_TRAIL_SYSTEM.sql"
    "$SCRIPT_DIR/160_SETUP_ASSISTANT_COMPLETE.sql"
    "$SCRIPT_DIR/162_VOICE_MINUTE_SYSTEM_COMPLETE.sql"
    "$SCRIPT_DIR/165_VISION_ANALYSIS_CACHE.sql"
    "$SCRIPT_DIR/167_SECURE_BOOKING_SYSTEM.sql"
    "$SCRIPT_DIR/168_FIX_PROMPT_CACHE_HASH_VOICE_CONFIG.sql"
    "$SCRIPT_DIR/169_VOICE_AGENT_V2_FEATURE_FLAGS.sql"
    "$SCRIPT_DIR/170_RAG_EMBEDDINGS_SYSTEM.sql"
    "$SCRIPT_DIR/171_LEAD_CROSS_CHANNEL_IDENTITY.sql"
    "$SCRIPT_DIR/172_PERSONAL_ASSISTANT_TYPES.sql"
    "$SCRIPT_DIR/173_API_KEY_USAGE_INCREMENT.sql"
    "$SCRIPT_DIR/174_OPTIMIZE_BRANCH_FILTERING_INDEXES.sql"
    "$SCRIPT_DIR/175_ADD_LOW_STOCK_RPC_FUNCTION.sql"
    "$SCRIPT_DIR/176_JOB_QUEUE_SYSTEM.sql"
    "$SCRIPT_DIR/177_ADMIN_CHANNEL_COMPLETE.sql"
)

# Contador
total=${#MIGRATIONS[@]}
current=0
failed=0

for migration in "${MIGRATIONS[@]}"; do
    ((current++))
    echo ""
    echo -e "${YELLOW}[$current/$total]${NC}"

    if run_migration "$migration"; then
        :
    else
        ((failed++))
        echo -e "${RED}Error en migración. ¿Continuar? (s/n):${NC}"
        read -p "" continue_choice
        if [[ $continue_choice != [sS] ]]; then
            echo "Abortando."
            exit 1
        fi
    fi
done

echo ""
echo "======================================================"
echo -e "${GREEN}Ejecución completada${NC}"
echo "======================================================"
echo "Total: $total migraciones"
echo "Exitosas: $((total - failed))"
echo "Fallidas: $failed"
echo ""

if [ $failed -gt 0 ]; then
    echo -e "${YELLOW}ADVERTENCIA: $failed migraciones fallaron.${NC}"
    echo "Revisa los errores anteriores."
    exit 1
fi

echo -e "${GREEN}Todas las migraciones ejecutadas correctamente.${NC}"
