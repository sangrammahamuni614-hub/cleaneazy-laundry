# CleanEazy Laundry

CleanEazy Laundry साठी सार्वजनिक मराठी वेबसाइट आणि कपडे धुलाई व्यवसाय व्यवस्थापन प्रणाली.

## संकेतस्थळे

- सार्वजनिक वेबसाइट: https://sangrammahamuni614-hub.github.io/cleaneazy-laundry/
- व्यवस्थापन प्रणाली: https://sangrammahamuni614-hub.github.io/cleaneazy-laundry/software/
- GitHub repository: https://github.com/sangrammahamuni614-hub/cleaneazy-laundry

## Windows वर सुरू करा

1. या फोल्डरमधील `START-CLEANEAZY.bat` उघडा.
2. व्यवस्थापन प्रणालीसाठी `/software/` पत्ता उघडा.
3. स्थानिक सरावासाठी `नमुना सराव सुरू करा` निवडा. या सरावातील नोंदी फक्त त्या ब्राउझरमध्ये राहतात; त्या Cloud डेटाबेसमध्ये जात नाहीत.
4. प्रत्यक्ष कामासाठी विद्यमान व्यवस्थापक खाते वापरून लॉगिन करा.
5. सर्व्हर बंद करण्यासाठी `STOP-CLEANEAZY.bat` उघडा.

या संगणकावर Node.js उपलब्ध आहे. अतिरिक्त पॅकेज स्थापना आवश्यक नाही. JavaScript तपासण्यासाठी `node --check assets/site.js`, `node --check software/app.js`, `node --check software/sw.js` आणि `node --check tools/local-server.cjs` चालवा.

## दरपत्रक

| सेवा | दर |
| --- | ---: |
| धुलाई | ₹८० / किलो |
| धुलाई + इस्त्री | ₹११० / किलो |
| शर्ट / पँट | ₹४० / वस्तू |
| ब्लँकेट | ₹८० / किलो |
| बॅग / शूज | ₹११० / वस्तू |
| ड्रायक्लीन साडी | ₹१६० / वस्तू |
| इतर कपडे | ₹५० / वस्तू |

नवीन ग्राहकाच्या पहिल्या ऑर्डरवर २५% स्वागत सवलत आपोआप लागू होते. सवलत सर्व्हरवर ऑर्डर तयार होताना मोजली जाते आणि बिलात एकूण सवलत म्हणून नोंदवली जाते.

## प्रणाली

- ग्राहक, सेवा, ऑर्डर, बिल, पेमेंट, सदस्य योजना, अहवाल आणि बॅकअप व्यवस्थापन.
- प्रत्यक्ष नोंदी Supabase Auth आणि RLS ने सुरक्षित केलेल्या Supabase PostgreSQL मध्ये साठतात.
- WhatsApp Cloud API संदेश, webhook आणि तासागणिक reminder queue जोडलेले आहेत. Meta access token, phone number ID, verify token आणि मंजूर message templates सेट केल्यावरच संदेश प्रत्यक्ष पाठवता येतील.
- `/software/` शोधयंत्रांपासून लपवला आहे. सार्वजनिक वेबसाइट आणि व्यवस्थापन प्रणालीचे एकच निश्चित पत्ते आहेत.

## सुरक्षेची काळजी

`software/runtime-config.js` मधील Supabase publishable key ही browser मध्ये वापरण्यासाठीची सार्वजनिक key आहे. Service role key, WhatsApp token, ग्राहक export किंवा इतर गुपिते repository मध्ये ठेवू नका. बॅकअपमध्ये वैयक्तिक ग्राहक माहिती असू शकते; तो सुरक्षित ठिकाणी जतन करा.

सुरुवात, Supabase, WhatsApp आणि बाकीचे आवश्यक खाते-सेटअप [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) मध्ये दिले आहेत.
