import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { CreateUserRequest, User } from '@/types'
import { z } from 'zod'

// Validation schema
const CreateUserSchema = z.object({
  email: z.string().email('Geçersiz e-posta'),
  displayName: z.string().min(2, 'İsim en az 2 karakter olmalı'),
  role: z.enum(['admin', 'bashakem', 'hakem', 'masa_hakemi']),
  judgeId: z.string().optional(),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
})

/**
 * POST /api/auth/create-user
 * Create a new user with custom claims (role)
 * Only admin can call this endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateUserRequest & { password: string }

    // Validate request
    const validationResult = CreateUserSchema.safeParse(body)
    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ')
      return NextResponse.json({ error: errors }, { status: 400 })
    }

    const { email, displayName, role, judgeId, password } = validationResult.data

    const adminAuth = getAdminAuth()
    const adminDb = getAdminDb()

    // Create Firebase Auth user
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
      emailVerified: false,
    })

    // Set custom claims (role)
    await adminAuth.setCustomUserClaims(userRecord.uid, { role })

    // Create user document in Firestore
    const userDoc: User = {
      uid: userRecord.uid,
      email,
      displayName,
      role,
      language: 'tr',
      judgeId: judgeId || undefined,
      createdAt: new Date(),
      createdBy: 'admin', // TODO: Get from auth context
    }

    await adminDb.collection('users').doc(userRecord.uid).set(userDoc)

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: `${displayName} kullanıcısı başarıyla oluşturuldu`,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          role,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create user error:', error)

    let errorMessage = 'Kullanıcı oluşturma hatası'

    if (error instanceof Error) {
      if (error.message.includes('email-already-exists')) {
        errorMessage = 'Bu e-posta adresi zaten kayıtlı'
      } else if (error.message.includes('weak-password')) {
        errorMessage = 'Şifre çok zayıf'
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}
