const fs = require('fs');

function fixAdminUI(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Replace the rendering block in AdminMessages.jsx
  const oldRenderRegex = /\(selectedConv\.messages \|\| \[\]\)\.map\(\(msg\) => \{[\s\S]*?<\/div>\s*<\/div>\s*\);\s*\}\)/;
  
  const newRenderReplacement = `(selectedConv.messages || []).map((msg, msgIndex) => {
                          const isAdmin = msg.from === "admin";
                          const hasMention = !isAdmin && msg.text?.includes(\`@\${adminName}\`);
                          return (
                            <div key={\`msg-\${msg.id}-\${msgIndex}\`} className={\`flex \${isAdmin ? "justify-end" : "justify-start"}\`}>
                              <div className={\`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm \${
                                isAdmin
                                  ? "bg-blue-600 text-white rounded-br-sm"
                                  : hasMention
                                  ? "bg-yellow-50 border border-yellow-200 text-gray-900 rounded-bl-sm"
                                  : "bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-sm"
                              }\`}>
                                {hasMention && (
                                  <p className="text-[10px] text-yellow-600 font-semibold mb-1 flex items-center gap-1">
                                    <AtSign className="w-2.5 h-2.5" /> Mentioned you
                                  </p>
                                )}
                                {((msg.attachments && msg.attachments.length > 0) || msg.fileUrl || msg.fileName) && (
                                    <div className="mb-2 space-y-2">
                                      {!msg.attachments?.length && (msg.fileUrl || msg.fileName) && (
                                        <div className={\`flex items-center gap-2 p-2 rounded-lg \${
                                          isAdmin ? "bg-blue-700/50 text-blue-100" : "bg-gray-100 text-gray-700"
                                        }\`}>
                                          {msg.attachmentKind === "image" ? (
                                            <img src={msg.fileUrl} alt="attachment" className="max-w-[200px] rounded-md" />
                                          ) : msg.attachmentKind === "video" ? (
                                            <Video className="w-5 h-5" />
                                          ) : (
                                            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
                                              <Download className="w-4 h-4 flex-shrink-0" />
                                              <span className="truncate max-w-[200px]">{msg.fileName || "Download file"}</span>
                                            </a>
                                          )}
                                        </div>
                                      )}
                                      
                                      {msg.attachments?.map((att, idx) => (
                                        <div key={idx} className={\`flex items-center gap-2 p-2 rounded-lg \${
                                          isAdmin ? "bg-blue-700/50 text-blue-100" : "bg-gray-100 text-gray-700"
                                        }\`}>
                                          {att.kind === "image" ? (
                                            <img src={att.url} alt="attachment" className="max-w-[200px] max-h-[200px] rounded-md object-contain" />
                                          ) : att.kind === "video" ? (
                                            <Video className="w-5 h-5" />
                                          ) : (
                                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
                                              <Download className="w-4 h-4 flex-shrink-0" />
                                              <span className="truncate max-w-[200px]">{att.name || "Download file"}</span>
                                            </a>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                {msg.text && <p className="leading-relaxed">{msg.text}</p>}
                                <div className={\`flex items-center justify-end gap-1 mt-1\`}>
                                  <p className={\`text-xs \${isAdmin ? "text-blue-100" : "text-gray-500"}\`}>
                                    {getTimeLabel(msg.time)}
                                  </p>
                                  {isAdmin && (
                                    <span className="flex-shrink-0" title={msg.isSeen ? "Seen" : "Sent"}>
                                      {msg.isSeen ? (
                                        <CheckCheck className="w-3 h-3 text-blue-200" />
                                      ) : (
                                        <CheckCheck className="w-3 h-3 text-blue-300/50" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })`;

  code = code.replace(oldRenderRegex, newRenderReplacement);
  
  // Make sure CheckCheck is imported in AdminMessages.jsx
  if (!code.includes('CheckCheck')) {
      code = code.replace(/import \{([^}]+)\} from "lucide-react";/, 'import { $1, CheckCheck } from "lucide-react";');
  }

  fs.writeFileSync(filePath, code);
  console.log('Updated AdminMessages layout to match TeacherMessages.');
}

try {
  fixAdminUI('src/app/pages/admin/AdminMessages.jsx');
} catch (e) {
  console.error(e);
}
