import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { 
  verifyMessage, 
  createPublicClient, 
  http, 
  decodeAbiParameters,
  parseAbiParameters,
  encodeAbiParameters,
  hashMessage
} from 'viem';
import { base } from 'viem/chains';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

const EIP6492_MAGIC_BYTES = '0x6492649264926492649264926492649264926492649264926492649264926492';

function decodeEIP6492Signature(signature: string) {
  const sigWithoutMagic = signature.slice(0, -64);
  
  try {
    const decoded = decodeAbiParameters(
      parseAbiParameters('address, bytes, bytes'),
      sigWithoutMagic as `0x${string}`
    );
    
    return {
      factory: decoded[0],
      factoryCalldata: decoded[1],
      originalSignature: decoded[2]
    };
  } catch (error) {
    console.error('Failed to decode EIP-6492:', error);
    return null;
  }
}

async function verifySignature(
  address: string,
  message: string,
  signature: string,
  nonce: string
): Promise<boolean> {
  try {
    const isEIP6492 = signature.endsWith(EIP6492_MAGIC_BYTES.slice(2));
    
    console.log('\n=== VERIFICATION DEBUG ===');
    console.log('Address:', address);
    console.log('Signature type:', isEIP6492 ? 'EIP-6492 (Smart Wallet)' : 'Standard (EOA)');
    
    const code = await publicClient.getBytecode({ address: address as `0x${string}` });
    const isDeployed = code && code !== '0x';
    console.log('Wallet deployed?', isDeployed ? 'YES' : 'NO');
    
    if (isEIP6492) {
      const decoded = decodeEIP6492Signature(signature);
      
      if (!decoded) {
        console.error('Failed to decode EIP-6492 signature');
        return false;
      }
      
      if (isDeployed) {
        // SECURE: Wallet sudah deploy, pakai EIP-1271
        console.log('Using EIP-1271 verification (SECURE)');
        
        try {
          const messageHash = hashMessage(message);
          const isValidSigSelector = '0x1626ba7e';
          
          const callData = encodeAbiParameters(
            parseAbiParameters('bytes32, bytes'),
            [messageHash as `0x${string}`, decoded.originalSignature as `0x${string}`]
          );
          
          const result = await publicClient.call({
            to: address as `0x${string}`,
            data: `${isValidSigSelector}${callData.slice(2)}` as `0x${string}`,
          });
          
          const isValid = result?.data === '0x1626ba7e';
          console.log('EIP-1271 result:', isValid);
          
          return isValid;
        } catch (error: any) {
          console.error('EIP-1271 failed:', error.message);
          return false;
        }
      } else {
        // LESS SECURE: Wallet belum deploy
        console.log('Wallet not deployed, using nonce-based validation');
        
        // PENTING: Check nonce sudah pernah dipakai atau belum
        const { data: existingNonce } = await supabaseAdmin
          .from('used_nonces')
          .select('nonce')
          .eq('nonce', nonce)
          .eq('address', address.toLowerCase())
          .single();
        
        if (existingNonce) {
          console.log('Nonce already used (replay attack blocked)');
          return false;
        }
        
        // Check nonce freshness
        const nonceTimestamp = parseInt(nonce);
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        const isFresh = (now - nonceTimestamp) < fiveMinutes;
        console.log('Nonce fresh?', isFresh);
        
        if (!isFresh) {
          console.log('Nonce too old');
          return false;
        }
        
       // SIMPAN NONCE untuk prevent replay
        const { error: insertError } = await supabaseAdmin
        .from('used_nonces')
        .insert({
            nonce: nonce,
            address: address.toLowerCase(),
            used_at: new Date().toISOString()
        });

        if (insertError) {
        console.error('Failed to save nonce:', insertError);
        
        // Jika duplicate key (race condition), tolak request
        if (insertError.code === '23505') { // PostgreSQL unique constraint violation
            console.log('Nonce already used (race condition detected)');
            return false;
        }
        
        // Untuk error lain, juga tolak untuk safety
        console.log('Database error, rejecting for safety');
        return false;
        }

        console.log('Nonce saved, accepting signature');
        return true;
      }
    } else {
      // Standard EOA
      console.log('Standard EOA verification...');
      
      try {
        const isValid = await verifyMessage({
          address: address as `0x${string}`,
          message: message,
          signature: signature as `0x${string}`,
        });
        
        console.log('Standard verification result:', isValid);
        return isValid;
      } catch (error: any) {
        console.error('Standard verification failed:', error.message);
        return false;
      }
    }
  } catch (error: any) {
    console.error('UNEXPECTED ERROR:', error);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const { address, signature, nonce } = await req.json();
    
    console.log('\n=== INCOMING REQUEST ===');
    console.log('Address:', address);
    console.log('Nonce:', nonce);
    
    const message = `Selamat datang di Arisako!\n\nNonce: ${nonce}`;
    
    const isValid = await verifySignature(address, message, signature, nonce);
    
    console.log('\n=== FINAL RESULT ===');
    console.log('Valid?', isValid);

    if (!isValid) {
      return NextResponse.json({ 
        error: 'Signature gagal diverifikasi',
      }, { status: 401 });
    }

    const email = `${address.toLowerCase()}@wallet.local`;
    const password = `${address.toLowerCase()}AUTH_SECRET`; 

    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    let user = users.find((u) => u.email === email);

    if (!user) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { 
          wallet_address: address,
          username: `user_${address.slice(2, 8)}` 
        }
      });
      if (createError) throw createError;
      user = newUser.user;
    }

    const { data, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) throw loginError;

    return NextResponse.json({ session: data.session });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Backend Error:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}