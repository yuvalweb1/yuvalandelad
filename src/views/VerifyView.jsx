export default function VerifyView({ diagnostics, analytics, fileName, t, onContinue, onReset }) {
  // Compute the line-accounting: how is each raw line classified?
  const accounted =
    diagnostics.parsedMessages +
    diagnostics.continuationLines +
    diagnostics.systemMessages +
    diagnostics.deletedMessages +
    diagnostics.skippedUnparseable;
  const unaccounted = diagnostics.nonEmptyLines - accounted;

  // Build sorted per-author tables for easy comparison
  const perAuthor = Object.keys(diagnostics.perAuthorCount).map(a => ({
    author: a,
    messages: diagnostics.perAuthorCount[a] || 0,
    words: diagnostics.perAuthorWordCount[a] || 0,
    media: diagnostics.perAuthorMediaCount[a] || 0,
    voice: diagnostics.perAuthorVoiceCount[a] || 0,
  })).sort((a, b) => b.messages - a.messages);
  const maxMsgs = perAuthor[0]?.messages || 1;
  const maxWords = Math.max(...perAuthor.map(p => p.words), 1);

  const confidence = diagnostics.confidence;
  const confColor = confidence >= 90 ? '#f9c74f' : confidence >= 70 ? '#f9c74f' : '#f3722c';
  const confLabel = confidence >= 90 ? 'High' : confidence >= 70 ? 'Medium' : 'Low';

  return (
    <div className="no-sb" style={{
      height: '100%', overflowY: 'auto', background: '#0a0a0f',
    }}>
      <div style={{ padding: '16px 18px 28px' }}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6,
        }}>
          <div className="fs-display" style={{
            fontSize: 32, lineHeight: 1, letterSpacing: '-0.03em', flex: 1,
          }}>
            {t.verify_title} <span style={{ fontStyle: 'italic', color: '#f9c74f' }}>{t.verify_right}</span>?
          </div>
          <button onClick={onReset} className="press" style={{
            background: 'transparent', border: 'none',
            color: '#b8b8c8', padding: '10px 10px', minHeight: 44,
            fontSize: 22, cursor: 'pointer', flexShrink: 0,
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}>{t.verify_reset}</button>
        </div>
        <div style={{ fontSize: 22, color: '#d0d0e0', lineHeight: 1.5, marginBottom: 18 }}>
          {t.verify_sub}
        </div>

        {/* Confidence card */}
        <div style={{
          padding: 16, marginBottom: 18,
          background: `${confColor}10`,
          border: `1px solid ${confColor}40`,
          borderRadius: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="fs-display" style={{
              fontSize: 56, lineHeight: 1, letterSpacing: '-0.04em', color: confColor,
            }}>
              {confidence}<span style={{ fontSize: 24 }}>%</span>
            </div>
            <div className="fs-mono" style={{ fontSize: 20, color: confColor, letterSpacing: '0.18em', fontWeight: 700 }}>
              {confLabel.toUpperCase()}
            </div>
          </div>
          {diagnostics.warnings.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {diagnostics.warnings.map((w, i) => (
                <div key={i} style={{
                  fontSize: 21, color: confColor, lineHeight: 1.4,
                  display: 'flex', gap: 6, alignItems: 'flex-start',
                }}>
                  <span>⚠</span>
                  <span style={{ flex: 1 }}>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* (1-4) Line accounting */}
        <SectionTitle label="LINE ACCOUNTING" />
        <div style={{
          background: '#15151d', border: '1px solid #2a2a36', borderRadius: 12, overflow: 'hidden',
          marginBottom: 18,
        }}>
          <VRow label="Total raw lines" value={diagnostics.rawLineCount.toLocaleString()} />
          <VRow label="Non-empty lines" value={diagnostics.nonEmptyLines.toLocaleString()} />
          <VRow label="Parsed messages" value={diagnostics.parsedMessages.toLocaleString()} accent />
          <VRow label="Continuation lines" value={diagnostics.continuationLines.toLocaleString()}
            hint="multi-line message bodies" />
          <VRow label="Ignored system messages" value={diagnostics.systemMessages.toLocaleString()}
            hint="join/leave/encryption notices" />
          <VRow label="Deleted messages" value={diagnostics.deletedMessages.toLocaleString()} />
          <VRow label="Media messages" value={diagnostics.mediaMessages.toLocaleString()} />
          <VRow label="Voice messages" value={diagnostics.voiceMessages.toLocaleString()} />
          <VRow label="Unsupported / skipped lines"
            value={diagnostics.skippedUnparseable.toLocaleString()}
            warn={diagnostics.skippedUnparseable > diagnostics.nonEmptyLines * 0.05}
            hint="couldn't attach to a known header" />
          <VRow label="Unaccounted" value={unaccounted.toLocaleString()}
            warn={Math.abs(unaccounted) > 0}
            hint="should be 0 if all lines were classified"
            last />
        </div>

        {/* (5) Detected participants */}
        <SectionTitle label={`DETECTED PARTICIPANTS · ${perAuthor.length}`} />
        <div style={{
          background: '#15151d', border: '1px solid #2a2a36', borderRadius: 12,
          padding: '12px 14px', marginBottom: 18,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {perAuthor.map(p => (
              <div key={p.author} className="fs-mono" style={{
                background: '#0a0a0f',
                padding: '5px 10px', borderRadius: 999,
                fontSize: 21, color: '#f4f4f8',
              }}>
                {p.author}
              </div>
            ))}
          </div>
          {perAuthor.length === 1 && (
            <div style={{ marginTop: 10, fontSize: 21, color: '#f9c74f', lineHeight: 1.4 }}>
              ⚠ Only one participant detected. If this is a group chat, the parser may have failed.
            </div>
          )}
        </div>

        {/* (7) Per-user message count table */}
        <SectionTitle label="MESSAGES PER PARTICIPANT" />
        <div style={{
          background: '#15151d', border: '1px solid #2a2a36', borderRadius: 12,
          overflow: 'hidden', marginBottom: 18,
        }}>
          {perAuthor.map((p, i) => {
            const pct = (p.messages / diagnostics.parsedMessages) * 100;
            return (
              <div key={p.author} style={{
                position: 'relative', padding: '11px 14px',
                borderBottom: i < perAuthor.length - 1 ? '1px solid #2a2a36' : 'none',
              }}>
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0,
                  width: `${(p.messages / maxMsgs) * 100}%`,
                  background: 'rgba(249,199,79,0.06)',
                }} />
                <div style={{
                  position: 'relative', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center', gap: 10,
                }}>
                  <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', width: 18, fontWeight: 700 }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{
                    flex: 1, fontSize: 23, fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{p.author}</div>
                  <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', minWidth: 42, textAlign: 'right' }}>
                    {pct.toFixed(1)}%
                  </div>
                  <div className="fs-mono" style={{ fontSize: 22, color: '#f9c74f', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
                    {p.messages.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{
            padding: '9px 14px', background: '#0a0a0f',
            borderTop: '1px solid #2a2a36',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', letterSpacing: '0.1em' }}>
              TOTAL
            </div>
            <div className="fs-mono" style={{ fontSize: 22, color: '#fff', fontWeight: 700 }}>
              {diagnostics.parsedMessages.toLocaleString()}
            </div>
          </div>
        </div>

        {/* (8) Per-user word count table */}
        <SectionTitle label="WORDS PER PARTICIPANT" />
        <div style={{
          background: '#15151d', border: '1px solid #2a2a36', borderRadius: 12,
          overflow: 'hidden', marginBottom: 18,
        }}>
          {perAuthor.map((p, i) => {
            const avg = p.messages > 0 ? p.words / p.messages : 0;
            return (
              <div key={p.author} style={{
                position: 'relative', padding: '11px 14px',
                borderBottom: i < perAuthor.length - 1 ? '1px solid #2a2a36' : 'none',
              }}>
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0,
                  width: `${(p.words / maxWords) * 100}%`,
                  background: 'rgba(39,125,161,0.06)',
                }} />
                <div style={{
                  position: 'relative', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center', gap: 10,
                }}>
                  <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', width: 18, fontWeight: 700 }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{
                    flex: 1, fontSize: 23, fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{p.author}</div>
                  <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', minWidth: 42, textAlign: 'right' }}>
                    {avg.toFixed(1)} avg
                  </div>
                  <div className="fs-mono" style={{ fontSize: 22, color: '#277da1', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
                    {p.words.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Media / voice per user — extra signal */}
        {perAuthor.some(p => p.media > 0 || p.voice > 0) && (
          <>
            <SectionTitle label="MEDIA & VOICE PER PARTICIPANT" />
            <div style={{
              background: '#15151d', border: '1px solid #2a2a36', borderRadius: 12,
              overflow: 'hidden', marginBottom: 18,
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto',
                gap: 12, padding: '9px 14px', borderBottom: '1px solid #2a2a36',
              }}>
                <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', letterSpacing: '0.15em' }}>PARTICIPANT</div>
                <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', letterSpacing: '0.15em', textAlign: 'right' }}>MEDIA</div>
                <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', letterSpacing: '0.15em', textAlign: 'right', minWidth: 36 }}>VOICE</div>
              </div>
              {perAuthor.map((p, i) => (
                <div key={p.author} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto',
                  gap: 12, padding: '10px 14px',
                  borderBottom: i < perAuthor.length - 1 ? '1px solid #2a2a36' : 'none',
                  alignItems: 'center',
                }}>
                  <div style={{
                    fontSize: 23,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{p.author}</div>
                  <div className="fs-mono" style={{ fontSize: 22, color: p.media > 0 ? '#f9c74f' : '#6a6a7a', textAlign: 'right', fontWeight: 600 }}>
                    {p.media.toLocaleString()}
                  </div>
                  <div className="fs-mono" style={{ fontSize: 22, color: p.voice > 0 ? '#277da1' : '#6a6a7a', textAlign: 'right', fontWeight: 600, minWidth: 36 }}>
                    {p.voice.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Parser meta */}
        <SectionTitle label="PARSER META" />
        <div style={{
          background: '#15151d', border: '1px solid #2a2a36', borderRadius: 12, overflow: 'hidden',
          marginBottom: 18,
        }}>
          <VRow label="File" value={fileName} />
          <VRow label="Detected format"
            value={diagnostics.detectedFormat
              ? (diagnostics.detectedFormat === 'ios_bracket' ? 'iOS (bracketed)' : 'Android (dash)')
              : 'none'}
            warn={!diagnostics.detectedFormat}
          />
          <VRow label="BOM" value={diagnostics.hadBOM ? 'present, stripped' : 'none'} />
          <VRow label="RTL marks" value={diagnostics.hadDirectionalMarks ? 'present, stripped' : 'none'} />
          <VRow label="Date range"
            value={`${analytics.start.toLocaleDateString()} → ${analytics.end.toLocaleDateString()}`} />
          <VRow label="Duration" value={`${analytics.durationDays} days`} last />
        </div>

        {/* (6) First 20 parsed messages */}
        <SectionTitle label="FIRST 20 PARSED MESSAGES" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {diagnostics.sample.map((s, i) => (
            <div key={i} style={{
              background: '#15151d', border: '1px solid #2a2a36',
              borderRadius: 10, padding: 10, fontSize: 20, lineHeight: 1.5,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 6,
              }}>
                <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc' }}>
                  #{String(i + 1).padStart(2, '0')} · line {s.rawLineIdx}
                </div>
                {s.flags && (
                  <div className="fs-mono" style={{
                    fontSize: 20, color: '#f9c74f', letterSpacing: '0.1em',
                    background: 'rgba(249,199,79,0.14)', padding: '3px 8px', borderRadius: 4,
                  }}>
                    {s.flags}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 6, fontSize: 20 }}>
                <div className="fs-mono" style={{ color: '#c8c8dc' }}>timestamp</div>
                <div className="fs-mono" style={{ color: '#f9c74f' }}>{s.timestamp}</div>
                <div className="fs-mono" style={{ color: '#c8c8dc' }}>sender</div>
                <div style={{ color: '#fff', fontWeight: 600 }}>{s.author}</div>
                <div className="fs-mono" style={{ color: '#c8c8dc' }}>content</div>
                <div style={{ color: '#d0d0e0', wordBreak: 'break-word' }}>{s.contentPreview}</div>
              </div>
              <div className="fs-mono" style={{
                marginTop: 8, paddingTop: 8, borderTop: '1px dashed #2a2a36',
                color: '#8b8b9d', fontSize: 20, wordBreak: 'break-all',
              }}>
                raw: {s.rawLine}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button onClick={onContinue} className="press" style={{
          width: '100%', position: 'relative', overflow: 'hidden',
          padding: 18, background: '#f9c74f', color: '#0a0a0f',
          border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 800,
          cursor: 'pointer', letterSpacing: '-0.01em',
          boxShadow: '0 12px 28px rgba(249,199,79,0.35)',
        }}>
          <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
          {t.verify_continue}
        </button>
        <button onClick={onReset} className="fs-mono press" style={{
          width: '100%', marginTop: 8, padding: 14, minHeight: 44,
          background: 'transparent', border: '1px solid #3a3a48',
          color: '#cfcfdc', borderRadius: 12, fontSize: 22,
          cursor: 'pointer', letterSpacing: '0.15em', fontWeight: 600,
        }}>
          {t.verify_wrong}
        </button>

      </div>
    </div>
  );
}

function SectionTitle({ label }) {
  return (
    <div className="fs-mono" style={{
      fontSize: 20, color: '#c8c8dc', letterSpacing: '0.2em', fontWeight: 600,
      marginBottom: 8, marginTop: 4,
    }}>
      {label}
    </div>
  );
}

function VRow({ label, value, accent, warn, hint, last }) {
  const valueColor = warn ? '#f3722c' : accent ? '#f9c74f' : '#fff';
  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: last ? 'none' : '1px solid #2a2a36',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div className="fs-mono" style={{ fontSize: 21, color: '#d0d0e0' }}>{label}</div>
        <div className="fs-mono" style={{
          fontSize: 22, color: valueColor, fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 180, textAlign: 'right',
        }}>{value}</div>
      </div>
      {hint && (
        <div className="fs-mono" style={{ fontSize: 20, color: '#8b8b9d', marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
