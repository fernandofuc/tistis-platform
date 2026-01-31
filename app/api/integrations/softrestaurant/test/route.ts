// =====================================================
// TIS TIS PLATFORM - Soft Restaurant Connection Test API
// DEPRECATED: Integration now uses webhook model (SR pushes to TIS TIS)
// See: /api/integrations/softrestaurant/webhook/[tenantId]
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';

// ======================
// POST - DEPRECATED Test Connection
// ======================

export async function POST(request: NextRequest) {
  // Authentication check
  const authResult = await getAuthenticatedContext(request);

  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { tenantId } = authResult;

  // Return deprecation notice with webhook URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.tistis.com';
  const webhookUrl = `${baseUrl}/api/integrations/softrestaurant/webhook/${tenantId}`;

  return NextResponse.json(
    {
      success: false,
      deprecated: true,
      message: 'Este endpoint está deprecado. La integración de Soft Restaurant ahora usa webhooks.',
      errorCode: 'DEPRECATED',
      migration: {
        newModel: 'webhook',
        description: 'Soft Restaurant debe enviar datos al webhook de TIS TIS',
        webhookUrl,
        documentation: 'OPE.ANA.SR11.Guia_para_el_modulo_de_conexion_de_ERP_y_PMS.pdf',
        requiredModule: 'Interface para ERP y PMS',
        contact: 'erik.basto@nationalsoft.com.mx',
      },
    },
    { status: 410 } // 410 Gone - indicates resource is no longer available
  );
}

// ======================
// GET - Info about deprecation
// ======================

export async function GET(request: NextRequest) {
  const authResult = await getAuthenticatedContext(request);

  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { tenantId } = authResult;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.tistis.com';
  const webhookUrl = `${baseUrl}/api/integrations/softrestaurant/webhook/${tenantId}`;

  return NextResponse.json({
    deprecated: true,
    message: 'La integración de Soft Restaurant ahora usa modelo de webhook',
    newModel: {
      type: 'webhook',
      description: 'Soft Restaurant envía datos de ventas a TIS TIS cuando se cierra un ticket',
      webhookUrl,
      documentation: 'OPE.ANA.SR11.Guia_para_el_modulo_de_conexion_de_ERP_y_PMS.pdf',
    },
    steps: [
      'Contactar a National Soft para adquirir el módulo "Interface para ERP y PMS"',
      'Configurar en SR: Configuración → Interface para ERP y PMS',
      'Ingresar la URL del webhook y el secret de autenticación',
      'Seleccionar envío de datos al cierre de cada ticket',
    ],
  });
}
