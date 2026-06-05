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

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmez le changement d’adresse email pour {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Vohitra Imo</Text>
        <Heading style={h1}>Confirmez votre nouvelle adresse email</Heading>
        <Text style={text}>
          Vous avez demandé à changer l’adresse email de votre compte {siteName} de{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{' '}
          vers{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>Cliquez sur le bouton ci-dessous pour confirmer ce changement.</Text>
        <Button style={button} href={confirmationUrl}>
          Confirmer le changement
        </Button>
        <Text style={footer}>
          Si vous n’êtes pas à l’origine de cette demande, sécurisez votre compte immédiatement.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 28px', border: '1px solid #ead8cc', borderRadius: '14px', backgroundColor: '#fffaf7' }
const brand = { color: '#c44a2a', fontSize: '13px', fontWeight: '700' as const, letterSpacing: '0.8px', textTransform: 'uppercase' as const, margin: '0 0 18px' }
const h1 = { fontSize: '26px', fontWeight: '700' as const, color: '#1f2933', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#4b5563', lineHeight: '1.65', margin: '0 0 18px' }
const link = { color: '#c44a2a', textDecoration: 'underline' }
const button = { backgroundColor: '#c44a2a', color: '#ffffff', fontSize: '15px', fontWeight: '700' as const, borderRadius: '8px', padding: '13px 22px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#7a6f68', lineHeight: '1.55', margin: '28px 0 0' }
