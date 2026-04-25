const fs = require('fs');

// Read the file as raw buffer
const buf = fs.readFileSync('prisma/schema.prisma');
let s = buf.toString('utf8');

// The file was corrupted starting around "model Document" matching null chars
// We can just rely on the fact that line 740 was `}` closing ProductOrigin.
// Let's just find the last clean `}` closing ProductOrigin.
const productOriginBlock = 'enum ProductOrigin {\n  LOCAL\n  INTERNATIONAL\n}';
const idx = s.indexOf(productOriginBlock);
if (idx !== -1) {
  const cleanEnd = idx + productOriginBlock.length;
  // Keep the valid utf-8 part
  let clean = s.slice(0, cleanEnd) + '\n\n';

  // Append our proper models
  clean += `model Document {
  id              String         @id @default(cuid())
  userId          String
  title           String
  type            String         @db.VarChar(32)
  fileUrl         String         @db.Text
  originalName    String         @db.Text
  mimeType        String         @db.VarChar(64)
  status          DocumentStatus @default(PENDING)
  verificationLog String?        @db.LongText
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("documents")
}

model VerificationRule {
  id              String   @id @default(cuid())
  documentType    String   @db.VarChar(64)
  criteria        String   @db.Text
  isActive        Boolean  @default(true)
  createdByUserId String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("verification_rules")
}

enum DocumentStatus {
  PENDING
  APPROVED
  REJECTED
}
`;

  fs.writeFileSync('prisma/schema.prisma', clean);
  console.log("Schema perfectly repaired and models appended.");
} else {
  console.error("Could not find the clean break point!");
}
