import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Vous êtes invité à rejoindre {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Vohitra Imo</Text>
        <Heading style={h1}>Vous êtes invité</Heading>
        <Text style={text}>
          Vous avez été invité à rejoindre{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Cliquez sur le bouton ci-dessous pour accepter l’invitation et créer votre compte.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accepter l’invitation
        </Button>
        <Text style={footer}>
          Si vous n’attendiez pas cette invitation, vous pouvez ignorer cet email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 28px', border: '1px solid #ead8cc', borderRadius: '14px', backgroundColor: '#fffaf7' }
const brand = { color: '#c44a2a', fontSize: '13px', fontWeight: '700' as const, letterSpacing: '0.8px', textTransform: 'uppercase' as const, margin: '0 0 18px' }
const h1 = { fontSize: '26px', fontWeight: '700' as const, color: '#1f2933', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#4b5563', lineHeight: '1.65', margin: '0 0 18px' }
const link = { color: '#c44a2a', textDecoration: 'underline' }
const button = { backgroundColor: '#c44a2a', color: '#ffffff', fontSize: '15px', fontWeight: '700' as const, borderRadius: '8px', padding: '13px 22px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#7a6f68', lineHeight: '1.55', margin: '28px 0 0' }
