import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre lien de connexion pour {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Vohitra Imo</Text>
        <Heading style={h1}>Votre lien de connexion</Heading>
        <Text style={text}>
          Cliquez sur le bouton ci-dessous pour vous connecter à {siteName}. Ce lien expirera bientôt.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Me connecter
        </Button>
        <Text style={footer}>
          Si vous n’avez pas demandé ce lien, vous pouvez ignorer cet email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 28px',
  border: '1px solid #ead8cc',
  borderRadius: '14px',
  backgroundColor: '#fffaf7',
}
const brand = { color: '#c44a2a', fontSize: '13px', fontWeight: '700' as const, letterSpacing: '0.8px', textTransform: 'uppercase' as const, margin: '0 0 18px' }
const h1 = { fontSize: '26px', fontWeight: '700' as const, color: '#1f2933', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#4b5563', lineHeight: '1.65', margin: '0 0 18px' }
const button = { backgroundColor: '#c44a2a', color: '#ffffff', fontSize: '15px', fontWeight: '700' as const, borderRadius: '8px', padding: '13px 22px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#7a6f68', lineHeight: '1.55', margin: '28px 0 0' }
