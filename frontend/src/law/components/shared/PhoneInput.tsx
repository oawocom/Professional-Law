'use client';
import { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';

// Azərbaycanda ən çox istifadə olunan mobil operator prefiksləri
var AZ_PREFIXES = ['50', '51', '55', '59', '70', '77', '60', '10'];

function parsePhone(value: string) {
  var v = (value || '').trim();
  var m = v.match(/^\+994[\s-]?(\d{2})[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})$/);
  if (m) return { mode: 'az', prefix: m[1], rest: m[2] + m[3] + m[4] };
  return { mode: 'custom', prefix: '', rest: v };
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Paylaşılan telefon nömrəsi sahəsi — +994 default seçilib (dəyişmək mümkündür),
// Azərbaycan mobil operator prefiksləri (50/51/55/59/70/77/60/10) seçim kimi
// verilir. Xarici müştəri və ya digər hallar üçün "Fərdi" rejiminə keçid var.
export function PhoneInput({ value, onChange, placeholder, className }: PhoneInputProps) {
  var initial = parsePhone(value || '');
  var [mode, setMode] = useState(initial.mode);
  var [prefix, setPrefix] = useState(initial.prefix || '50');
  var [rest, setRest] = useState(initial.mode === 'az' ? initial.rest : '');
  var [custom, setCustom] = useState(initial.mode === 'custom' ? initial.rest : '');

  useEffect(function() {
    var p = parsePhone(value || '');
    setMode(p.mode);
    if (p.mode === 'az') { setPrefix(p.prefix || '50'); setRest(p.rest); }
    else { setCustom(p.rest); }
    // eslint-disable-next-line
  }, [value]);

  var emit = function(nextMode: string, nextPrefix: string, nextRest: string, nextCustom: string) {
    if (nextMode === 'az') {
      var digits = (nextRest || '').replace(/\D/g, '').slice(0, 6);
      var formatted = digits.length > 0
        ? digits.slice(0, 3) + (digits.length > 3 ? ' ' + digits.slice(3, 5) : '') + (digits.length > 5 ? ' ' + digits.slice(5, 7) : '')
        : '';
      onChange('+994 ' + nextPrefix + (formatted ? ' ' + formatted : ''));
    } else {
      onChange(nextCustom || '');
    }
  };

  return (
    <div className={'flex gap-1.5 ' + (className || '')}>
      {mode === 'az' && (
        <Select value={prefix} onValueChange={function(v) { setPrefix(v); emit('az', v, rest, custom); }}>
          <SelectTrigger className="w-[100px] shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AZ_PREFIXES.map(function(p) { return <SelectItem key={p} value={p}>+994 {p}</SelectItem>; })}
          </SelectContent>
        </Select>
      )}
      {mode === 'az' ? (
        <Input className="flex-1" placeholder="123 45 67" value={rest}
          onChange={function(e: any) { var v = e.target.value; setRest(v); emit('az', prefix, v, custom); }} />
      ) : (
        <Input className="flex-1" placeholder={placeholder || 'Nömrəni daxil edin (xarici/digər)'} value={custom}
          onChange={function(e: any) { var v = e.target.value; setCustom(v); emit('custom', prefix, rest, v); }} />
      )}
      <Button type="button" variant="ghost" size="sm" className="text-[10px] shrink-0 h-9 px-2 text-muted-foreground"
        onClick={function() {
          var nm = mode === 'az' ? 'custom' : 'az';
          setMode(nm);
          emit(nm, prefix, rest, custom);
        }}>
        {mode === 'az' ? 'Fərdi' : '+994'}
      </Button>
    </div>
  );
}

export default PhoneInput;
