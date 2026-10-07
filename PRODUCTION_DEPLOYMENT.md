# CleanEazy Laundry — प्रत्यक्ष वापरासाठी सेटअप

## GitHub Pages

Repository: https://github.com/sangrammahamuni614-hub/cleaneazy-laundry

GitHub Pages साठी `main` branch आणि repository root निवडा. सार्वजनिक वेबसाइट `/` येथे आणि व्यवस्थापन प्रणाली फक्त `/software/` येथे उपलब्ध आहे.

- सार्वजनिक वेबसाइट: https://sangrammahamuni614-hub.github.io/cleaneazy-laundry/
- व्यवस्थापन प्रणाली: https://sangrammahamuni614-hub.github.io/cleaneazy-laundry/software/

या repository साठी custom domain वापरलेला नाही. `CNAME` फाइल जोडू नका.

## Supabase

- Project ref: `jcckvihjumqdmkcbaebo`
- Project URL: https://jcckvihjumqdmkcbaebo.supabase.co
- Frontend मध्ये फक्त publishable key वापरली आहे.
- खाते invitation द्वारे उपलब्ध आहे. विद्यमान सक्रिय व्यवस्थापक खात्याने लॉगिन करा.
- Supabase Auth च्या allowed redirect URLs मध्ये वर दिलेला `/software/` HTTPS पत्ता जोडा, म्हणजे invitation आणि password-reset दुवे योग्य प्रणालीत परत येतील.
- Auth password settings मध्ये leaked-password protection सुरू करा.

स्थानिक `supabase/migrations/` फोल्डरमध्ये सदस्य योजनेची मर्यादा, कपड्यांची नोंद आणि पहिल्या ऑर्डरवरील स्वागत सवलतीच्या migration आहेत. हे migrations live project मध्येही लागू केले आहेत. Supabase function source `supabase/functions/` मध्ये आहे.

## WhatsApp Cloud API

`send-whatsapp` worker आणि `whatsapp-webhook` function deploy झाले आहेत. Meta secrets आणि approved templates Supabase Edge Function secrets मध्ये सेट होईपर्यंत प्रत्यक्ष WhatsApp संदेश पाठवले जाणार नाहीत.

- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_API_VERSION` (पर्यायी; default `v23.0`)
- `WHATSAPP_VERIFY_TOKEN`
- `META_APP_SECRET`
- `WA_TEMPLATE_ORDER_RECEIVED`
- `WA_TEMPLATE_PICKUP_ASSIGNED`
- `WA_TEMPLATE_PICKED_UP`
- `WA_TEMPLATE_PROCESSING`
- `WA_TEMPLATE_WASHING_STARTED`
- `WA_TEMPLATE_IRONING`
- `WA_TEMPLATE_QUALITY_CHECK`
- `WA_TEMPLATE_READY`
- `WA_TEMPLATE_OUT_FOR_DELIVERY`
- `WA_TEMPLATE_DELIVERED`
- `WA_TEMPLATE_PAYMENT_CONFIRMATION`
- `WA_TEMPLATE_OUTSTANDING_REMINDER`

Webhook पत्ता: https://jcckvihjumqdmkcbaebo.supabase.co/functions/v1/whatsapp-webhook

आधीपासूनचा तासागणिक Supabase Cron due reminders संदेश रांगेत घालतो. WhatsApp Web किंवा browser automation वापरले जात नाही.

## सार्वजनिक संपर्क

सार्वजनिक फोन/WhatsApp क्रमांक अद्याप निश्चित नसल्यामुळे जाहिरातीत दाखवलेला नाही. निश्चित व्यवसाय क्रमांक मिळाल्यावर `assets/site-config.js` मधील `whatsappNumber` मध्ये भारतासाठी `91` आणि त्यापुढे १० अंकी क्रमांक द्या. पुष्टी केलेला सार्वजनिक ई-मेलही उपलब्ध नसल्यामुळे बनवलेला संपर्क तपशील दाखवलेला नाही.

## Windows वर चालवणे

- `START-CLEANEAZY.bat` स्थानिक HTTP server सुरू करतो.
- सार्वजनिक पृष्ठ `http://127.0.0.1:4173/` येथे आणि व्यवस्थापन पृष्ठ `http://127.0.0.1:4173/software/` येथे उघडा.
- `STOP-CLEANEAZY.bat` server बंद करतो.
- प्रत्यक्ष लॉगिन आणि WhatsApp साठी इंटरनेट व संबंधित खाते-सेटअप आवश्यक आहे.

## पडताळणीची मर्यादा

JavaScript syntax, स्थानिक HTTP routes आणि डेटाबेस transaction चाचण्या करता येतात. व्यवस्थापक लॉगिन, प्रत्यक्ष browser मधील संपूर्ण UI, सार्वजनिक फोन, Meta संदेश आणि मोबाइलवर PWA install यांची पडताळणीसाठी संबंधित खाते/secret आणि browser वापर आवश्यक आहे. चाचणी प्रत्यक्ष झाली नसेल तर feature ला PASS म्हणू नका.
