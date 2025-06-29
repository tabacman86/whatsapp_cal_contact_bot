const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

const OPENAI_API_KEY = SCRIPT_PROPERTIES.getProperty('OPENAI_API_KEY');
const CALENDAR_ID = SCRIPT_PROPERTIES.getProperty('CALENDAR_ID');
const TWILIO_ACCOUNT_SID = SCRIPT_PROPERTIES.getProperty('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = SCRIPT_PROPERTIES.getProperty('TWILIO_AUTH_TOKEN');
const REPLY_TO_EMAIL = SCRIPT_PROPERTIES.getProperty('REPLY_TO_EMAIL');
const FROM_WHATSAPP_NUMBER = SCRIPT_PROPERTIES.getProperty('TWILIO_WHASATPP_NUM');

function doPost(e) {
  const from = e.parameter.From || '';
  const ALLOWED_NUMBERS = [ 'whatsapp:+972xxxxxxxxx', 'whatsapp:+972xxxxxxxxxx'];

  if (!ALLOWED_NUMBERS.includes(from)) {
  sendWhatsAppReply(e.parameter.From , "my name is inigo montoya, you killed my father, prepare to die")
  return
  }


  const numMedia = parseInt(e.parameter.NumMedia || '0', 10);
  const mediaUrl = e.parameter.MediaUrl0;
  const mediaType = e.parameter.MediaContentType0;

  const body = (e.parameter.Body || '').trim();
  // const from = e.parameter.From || '';
  const now = new Date();
  let reply;

  if (body.toLowerCase().startsWith('add contact:')) {
  reply = handleContactRequest(body.replace(/^add contact:/i, '').trim(), from);

} else if (body) {
  const structured = extractEventDataFromOpenAI(body, now);
  
  if (structured) {
    // 🔍 Verify event validity using GPT
    const isLegit = verifyEventWithGPT(structured);
    if (isLegit) {
      reply = handleCalendarStructured(structured);
    } else {
      reply = `🛑 זה לא נראה כמו פגישה אמיתית ליומן.\n\nנסה בסגנון:\n"ביום רביעי ב-14:00 פגישה עם רופא שיניים"`;
    }
  } else {
    reply = `⛔ לא הבנתי כל כך. אפשר לשלוח שוב?\nדוגמה: "ביום חמישי ב-15:30 יש חיסון לילדים"`;
  }

} else if (numMedia > 0 && mediaType.startsWith("image/")) {
  reply = handleImageMessageWithoutAuth(mediaUrl, mediaType, from);

} else {
  reply = `⛔ I couldn’t understand your message.\nTry:\n"Meeting with Dana on Friday at 10am"\nor send a photo of the invite.`;
}

  sendWhatsAppReply(from, reply);
  return HtmlService.createHtmlOutput("OK");
}

function normalizeImageExtraction(output) {
  try {
    if (!output || !output.date || !output.time || !output.title) {
      throw new Error("Missing one or more required fields");
    }

    const start = new Date(`${output.date}T${output.time}:00+03:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour

    return {
      title: output.title || "",
      description: output.location ? `מיקום: ${output.location}` : "",
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString()
    };
  } catch (e) {
    Logger.log("Failed to normalize image extraction: " + e);
    return null;
  }
}

function handleImageMessageWithoutAuth(mediaUrl, mediaType, from) {
  try {
    const response = UrlFetchApp.fetch(mediaUrl, {
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200 || !mediaType.startsWith("image/")) {
      Logger.log("❌ Invalid media: " + response.getContentText());
      return `⚠️ לא הצלחתי להוריד את התמונה.`;
    }

    const imageBlob = response.getBlob();
    const base64Image = Utilities.base64Encode(imageBlob.getBytes());

    const prompt = `המשימה שלך היא לקרוא הזמנה מאוירת בעברית מתוך תמונה, ולחלץ ממנה נתונים רלוונטיים לאירוע בלוח שנה.

אנא החזר את המידע בפורמט JSON, כך:

{
  "title": "שם האירוע, למשל: יום הולדת לאיתן",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "location": "מקום האירוע"
}

אם חלק מהפרטים חסרים — החזר מפתח ריק ("").

אל תוסיף טקסט אחר — רק את האובייקט JSON.`;

    const visionResponse = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      payload: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64Image}` } }
            ]
          }
        ],
        max_tokens: 1000
      })
    });

    const visionResult = JSON.parse(visionResponse.getContentText());
    const reply = visionResult.choices[0].message.content.trim();
    // Try to extract JSON from GPT reply
    const jsonBlock = reply.match(/\{[\s\S]*\}/);
    if (!jsonBlock || !jsonBlock[0]) {
      Logger.log("No JSON found in GPT response");
      return `⚠️ לא הצלחתי להבין את התמונה.\n\nהתוצאה הייתה:\n${reply}`;
    }

    let extracted;
    try {
      extracted = JSON.parse(jsonBlock[0]);
    } catch (e) {
      Logger.log("⚠️ JSON parse error: " + e);
      return `⚠️ לא הצלחתי לנתח את התמונה. ייתכן שהמבנה לא תקין.\n\nשגיאה: ${e}`;
    }

    // Ensure required fields
    if (!extracted.title || !extracted.date || !extracted.time) {
      Logger.log("⚠️ Missing required fields in GPT result: " + JSON.stringify(extracted));
      return `⚠️ התמונה לא כללה פרטים מספיקים. נסה לשלוח שוב או להשתמש בטקסט.`;
    }

    // Convert to full calendar format
    const structured = normalizeImageExtraction(extracted);
    return handleCalendarStructured(structured);

  } catch (err) {
    Logger.log("📸 OCR error: " + err);
    return `⚠️ לא הצלחתי להבין את התמונה.\n\nשגיאה:\n${err.message}`;
  }
}

function extractEventDataFromOpenAI(text, referenceDate) {
  const referenceDateStr = Utilities.formatDate(referenceDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const systemPrompt = `אתה עוזר שממיר הודעות בעברית על פגישות לאירועים בלוח שנה.
היום הוא: ${referenceDateStr}
פרש תאריכים יחסיים כמו "שישי הבא", "מחר", וכו' בהתאם לתאריך הזה.

אם ההודעה לא כוללת שעת התחלה ברורה — אל תנחש שעה. החזר את המילה: null

אם ההודעה כן מתארת פגישה אמיתית, החזר תשובה כ-JSON בפורמט הבא:
{
  "title": "string",
  "description": "string",
  "startDateTime": "YYYY-MM-DDTHH:MM:SS+03:00",
  "endDateTime": "YYYY-MM-DDTHH:MM:SS+03:00"
}

חזור רק על האובייקט JSON או על null, ללא טקסט נוסף.

ההודעה:
"${text}"`;

  const payload = {
    model: "gpt-4o",
    messages: [{ role: "system", content: systemPrompt}, { role: "user", content: text}],
    temperature: 0.2
  };

  try {
    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      payload: JSON.stringify(payload)
    });

    const json = JSON.parse(response.getContentText());
    const reply = json.choices[0].message.content;

    return JSON.parse(reply);
  } catch (e) {
    Logger.log("Failed to parse GPT response: " + e);
    return null;
  }
}

function handleCalendarStructured(structured) {

  try {
    createCalendarEvent(structured);
    // sendConfirmationEmail(structured);
    return `✅ האירוע \"${structured.title}\" נוסף ליומן בהצלחה!`;
  } catch (err) {
    Logger.log(err);
    return `⚠️ הייתה שגיאה בעת הוספת האירוע ליומן. נסה שוב מאוחר יותר.`;
  }
}

function verifyEventWithGPT(structured) {
  const systemPrompt = `
אתה מקבל אובייקט שמייצג אירוע בלוח שנה, ומטרתך להחליט האם מדובר בפגישה או תזכורת אמיתית שמתאימה להוספה ליומן.

החזר רק את המילה:
- true — אם מדובר באירוע ממשי כמו פגישה, תור, טיסה, חיסון, יום הולדת, פגישה עם מישהו וכו'.
- false — אם הטקסט נראה כמו שאלה, בקשה כללית, בדיחה, שיחה כללית, מילה בודדת, או משהו שאינו דורש תזכורת ביומן.

דוגמאות חוקיות:
- "קבע פגישה מחר ב9:00 עם מורן בבית"
- "ביום שלישי ב-14:00 יש חיסון לילדים"
- "ארוחת ערב אצל ההורים בשבת"

דוגמאות לא חוקיות:
- "מה דעתך על מתכון?"
- "מישהו יודע איך לסדר את המדפסת?"
- "חחח מצחיק"

הייה מאוד ברור. החזר רק: true או false.
`;

  const userPrompt = `האירוע:
${JSON.stringify(structured, null, 2)}

האם מדובר באירוע מתאים ליומן?`;

  const payload = {
    model: "gpt-3.5-turbo",
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  };

  try {
    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      payload: JSON.stringify(payload)
    });

    const json = JSON.parse(response.getContentText());
    const reply = json.choices[0].message.content.trim().toLowerCase();

    return reply.includes("true");
  } catch (err) {
    Logger.log("Failed GPT event validation: " + err);
    return true; // fallback safe
  }
}


function createCalendarEvent(data) {
  const start = new Date(data.startDateTime);
  const end = new Date(data.endDateTime);

  if (start >= end) {
    throw new Error("זמן התחלה לא תקין – האירוע לא נוסף.");
  }

  return CalendarApp.getCalendarById(CALENDAR_ID).createEvent(data.title, start, end, {
    description: data.description
  });
}

function sendConfirmationEmail(eventData) {
  const subject = `✅ אירוע נוסף: ${eventData.title}`;
  const body = `
נוסף אירוע חדש ליומן:

כותרת: ${eventData.title}
מתחיל: ${eventData.startDateTime}
מסתיים: ${eventData.endDateTime}
  `;
  MailApp.sendEmail(REPLY_TO_EMAIL, subject, body);
}

function sendWhatsAppReply(to, message) {
  const payload = {
    To: to,
    From: FROM_WHATSAPP_NUMBER,
    Body: message
  };

  const options = {
    method: "post",
    payload: payload,
    headers: {
      Authorization: "Basic " + Utilities.base64Encode(TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN)
    }
  };

  UrlFetchApp.fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, options);
}

// 👤 CONTACT BOT LOGIC
function handleContactRequest(message, from) {
  const structured = extractContactFromOpenAI(message);
  if (!structured || !structured.firstName || !structured.lastName || !structured.phoneNumber) {
    return `❌ I couldn't understand the contact info.\n\nUse:\n"Add Contact: First Last, +972..., email, company, label"\nCompany/email/label are optional.`;
  }

  try {
    createContact(structured);
    return `✅ Contact "${structured.firstName} ${structured.lastName}" created successfully!`;
  } catch (err) {
    Logger.log(err);
    return `⚠️ Failed to create contact. Please try again.\nError: ${err.message}`;
  }
}

function extractContactFromOpenAI(message) {
  const prompt = `
You are a helpful assistant that extracts contact information from a user's English message.
Return a JSON object with the following fields:
{
  "firstName": "string",
  "lastName": "string",
  "company": "string",
  "phoneNumber": "string",
  "email": "string",
  "label": "string"
}
If any field is missing, return it as an empty string. Return only the JSON object.

Message: "${message}"
`;

  const payload = {
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2
  };

  try {
    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      payload: JSON.stringify(payload)
    });

    return JSON.parse(JSON.parse(response.getContentText()).choices[0].message.content);
  } catch (e) {
    Logger.log("Contact GPT parse failed: " + e);
    return null;
  }
}

function createContact(contact) {
  const resource = {
    names: [{ givenName: contact.firstName, familyName: contact.lastName }],
    phoneNumbers: [{ value: contact.phoneNumber }]
  };

  if (contact.email) resource.emailAddresses = [{ value: contact.email }];
  if (contact.company) resource.organizations = [{ name: contact.company }];

  const created = PeopleService.People.createContact(resource);

  if (contact.label) {
    const group = getOrCreateContactGroup(contact.label);
    addContactToGroupUsingREST(created.resourceName, group.resourceName);
  }
}

function getOrCreateContactGroup(labelName) {
  const groups = PeopleService.ContactGroups.list({ pageSize: 100 }).contactGroups || [];
  const existing = groups.find(g => g.formattedName.toLowerCase() === labelName.toLowerCase());
  if (existing) return existing;
  return PeopleService.ContactGroups.create({ contactGroup: { name: labelName } });
}

function addContactToGroupUsingREST(contactResourceName, groupResourceName) {
  const groupId = groupResourceName.split('/')[1];
  const url = `https://people.googleapis.com/v1/contactGroups/${groupId}/members:modify`;
  const payload = {
    resourceNamesToAdd: [contactResourceName]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() >= 400) {
    const result = JSON.parse(response.getContentText());
    throw new Error(`Group assignment failed: ${result.error?.message || response.getContentText()}`);
  }
}
