import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre code de vérification</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Vohitra Imo</Text>
        <Heading style={h1}>Confirmez votre identité</Heading>
        <Text style={text}>Utilisez le code ci-dessous pour confirmer votre identité.</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Ce code expirera bientôt. Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 28px', border: '1px solid #ead8cc', borderRadius: '14px', backgroundColor: '#fffaf7' }
const brand = { color: '#c44a2a', fontSize: '13px', fontWeight: '700' as const, letterSpacing: '0.8px', textTransform: 'uppercase' as const, margin: '0 0 18px' }
const h1 = { fontSize: '26px', fontWeight: '700' as const, color: '#1f2933', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#4b5563', lineHeight: '1.65', margin: '0 0 18px' }
const codeStyle = {
  display: 'inline-block',
  fontFamily: 'JetBrains Mono, Courier, monospace',
  fontSize: '26px',
  fontWeight: '700' as const,
  letterSpacing: '4px',
  color: '#1f2933',
  backgroundColor: '#f4e6dc',
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '2px 0 26px',
}
const footer = { fontSize: '12px', color: '#7a6f68', lineHeight: '1.55', margin: '28px 0 0' }
