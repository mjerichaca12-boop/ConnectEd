const fs = require('fs');

function updateTeacher(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  const attachmentRenderRegex = /\{msg\.fileUrl && \([\s\S]*?<\/div>\s*\n\s*\)\}/;
  const attachmentRenderReplacement = `{((msg.attachments && msg.attachments.length > 0) || msg.fileUrl || msg.fileName) && (
                                  <div className="mt-2 space-y-2">
                                    {!msg.attachments?.length && (msg.fileUrl || msg.fileName) && (
                                      <div className={\`flex items-center gap-2 p-2 rounded-lg \${
                                        isTeacher ? "bg-emerald-700/50" : "bg-gray-100"
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
                                        isTeacher ? "bg-emerald-700/50" : "bg-gray-100"
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
                                )}`;
  code = code.replace(attachmentRenderRegex, attachmentRenderReplacement);

  fs.writeFileSync(filePath, code);
  console.log('Updated rendering ' + filePath);
}

try {
  updateTeacher('src/app/pages/teacher/TeacherMessages.jsx');
} catch (e) {
  console.error(e);
}
