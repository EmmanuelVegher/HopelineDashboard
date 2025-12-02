import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const countryCodes = [
  { code: '+1', country: 'US', flag: '🇺🇸' },
  { code: '+7', country: 'RU', flag: '🇷🇺' },
  { code: '+20', country: 'EG', flag: '��🇬' },
  { code: '+27', country: 'ZA', flag: '🇿🇦' },
  { code: '+30', country: 'GR', flag: '🇬🇷' },
  { code: '+31', country: 'NL', flag: '🇳🇱' },
  { code: '+32', country: 'BE', flag: '🇧🇪' },
  { code: '+33', country: 'FR', flag: '🇫🇷' },
  { code: '+34', country: 'ES', flag: '🇪🇸' },
  { code: '+36', country: 'HU', flag: '🇭🇺' },
  { code: '+39', country: 'IT', flag: '🇮🇹' },
  { code: '+40', country: 'RO', flag: '🇷🇴' },
  { code: '+41', country: 'CH', flag: '🇨🇭' },
  { code: '+43', country: 'AT', flag: '🇦🇹' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+45', country: 'DK', flag: '🇩🇰' },
  { code: '+46', country: 'SE', flag: '🇸🇪' },
  { code: '+47', country: 'NO', flag: '🇳🇴' },
  { code: '+48', country: 'PL', flag: '🇵🇱' },
  { code: '+49', country: 'DE', flag: '🇩🇪' },
  { code: '+90', country: 'TR', flag: '🇹🇷' },
  { code: '+211', country: 'SS', flag: '🇸🇸' },
  { code: '+212', country: 'MA', flag: '🇲🇦' },
  { code: '+213', country: 'DZ', flag: '🇩🇿' },
  { code: '+216', country: 'TN', flag: '🇹🇳' },
  { code: '+218', country: 'LY', flag: '🇱🇾' },
  { code: '+220', country: 'GM', flag: '��🇲' },
  { code: '+221', country: 'SN', flag: '🇸🇳' },
  { code: '+222', country: 'MR', flag: '🇲🇷' },
  { code: '+223', country: 'ML', flag: '🇲🇱' },
  { code: '+224', country: 'GN', flag: '🇬🇳' },
  { code: '+225', country: 'CI', flag: '🇨🇮' },
  { code: '+226', country: 'BF', flag: '🇧🇫' },
  { code: '+227', country: 'NE', flag: '🇳🇪' },
  { code: '+228', country: 'TG', flag: '🇹🇬' },
  { code: '+229', country: 'BJ', flag: '🇧🇯' },
  { code: '+230', country: 'MU', flag: '🇲🇺' },
  { code: '+231', country: 'LR', flag: '🇱🇷' },
  { code: '+232', country: 'SL', flag: '🇸🇱' },
  { code: '+233', country: 'GH', flag: '🇬🇭' },
  { code: '+234', country: 'NG', flag: '🇳🇬' },
  { code: '+235', country: 'TD', flag: '🇹🇩' },
  { code: '+236', country: 'CF', flag: '🇨🇫' },
  { code: '+237', country: 'CM', flag: '🇨🇲' },
  { code: '+238', country: 'CV', flag: '🇨🇻' },
  { code: '+239', country: 'ST', flag: '🇸🇹' },
  { code: '+240', country: 'GQ', flag: '🇬🇶' },
  { code: '+241', country: 'GA', flag: '🇬🇦' },
  { code: '+242', country: 'CG', flag: '🇨🇬' },
  { code: '+243', country: 'CD', flag: '🇨🇩' },
  { code: '+244', country: 'AO', flag: '🇦🇴' },
  { code: '+245', country: 'GW', flag: '🇬🇼' },
  { code: '+246', country: 'IO', flag: '🇮🇴' },
  { code: '+248', country: 'SC', flag: '🇸🇨' },
  { code: '+249', country: 'SD', flag: '🇸🇩' },
  { code: '+250', country: 'RW', flag: '🇷🇼' },
  { code: '+251', country: 'ET', flag: '🇪🇹' },
  { code: '+252', country: 'SO', flag: '🇸🇴' },
  { code: '+253', country: 'DJ', flag: '🇩🇯' },
  { code: '+254', country: 'KE', flag: '🇰🇪' },
  { code: '+255', country: 'TZ', flag: '🇹🇿' },
  { code: '+256', country: 'UG', flag: '🇺🇬' },
  { code: '+257', country: 'BI', flag: '🇧🇮' },
  { code: '+258', country: 'MZ', flag: '🇲🇿' },
  { code: '+260', country: 'ZM', flag: '🇿🇲' },
  { code: '+261', country: 'MG', flag: '🇲🇬' },
  { code: '+262', country: 'RE', flag: '🇷🇪' },
  { code: '+263', country: 'ZW', flag: '🇿🇼' },
  { code: '+264', country: 'NA', flag: '🇳🇦' },
  { code: '+265', country: 'MW', flag: '🇲🇼' },
  { code: '+266', country: 'LS', flag: '🇱🇸' },
  { code: '+267', country: 'BW', flag: '🇧🇼' },
  { code: '+268', country: 'SZ', flag: '🇸🇿' },
  { code: '+269', country: 'KM', flag: '🇰🇲' },
  { code: '+290', country: 'SH', flag: '🇸🇭' },
  { code: '+291', country: 'ER', flag: '🇪🇷' },
  { code: '+297', country: 'AW', flag: '🇦🇼' },
  { code: '+298', country: 'FO', flag: '🇫🇴' },
  { code: '+299', country: 'GL', flag: '🇬🇱' },
  { code: '+350', country: 'GI', flag: '🇬🇮' },
  { code: '+351', country: 'PT', flag: '🇵🇹' },
  { code: '+352', country: 'LU', flag: '🇱🇺' },
  { code: '+353', country: 'IE', flag: '🇮🇪' },
  { code: '+354', country: 'IS', flag: '🇮🇸' },
  { code: '+355', country: 'AL', flag: '🇦🇱' },
  { code: '+356', country: 'MT', flag: '🇲🇹' },
  { code: '+357', country: 'CY', flag: '🇨🇾' },
  { code: '+358', country: 'FI', flag: '🇫🇮' },
  { code: '+359', country: 'BG', flag: '🇧🇬' },
  { code: '+370', country: 'LT', flag: '🇱🇹' },
  { code: '+371', country: 'LV', flag: '🇱🇻' },
  { code: '+372', country: 'EE', flag: '🇪🇪' },
  { code: '+373', country: 'MD', flag: '🇲🇩' },
  { code: '+374', country: 'AM', flag: '🇦🇲' },
  { code: '+375', country: 'BY', flag: '🇧🇾' },
  { code: '+376', country: 'AD', flag: '🇦🇩' },
  { code: '+377', country: 'MC', flag: '🇲🇨' },
  { code: '+378', country: 'SM', flag: '🇸🇲' },
  { code: '+380', country: 'UA', flag: '🇺🇦' },
  { code: '+381', country: 'RS', flag: '🇷🇸' },
  { code: '+382', country: 'ME', flag: '🇲🇪' },
  { code: '+383', country: 'XK', flag: '🇽🇰' },
  { code: '+385', country: 'HR', flag: '🇭🇷' },
  { code: '+386', country: 'SI', flag: '🇸🇮' },
  { code: '+387', country: 'BA', flag: '🇧🇦' },
  { code: '+389', country: 'MK', flag: '🇲🇰' },
  { code: '+420', country: 'CZ', flag: '🇨🇿' },
  { code: '+421', country: 'SK', flag: '🇸🇰' },
  { code: '+423', country: 'LI', flag: '🇱🇮' },
  { code: '+500', country: 'FK', flag: '🇫🇰' },
  { code: '+501', country: 'BZ', flag: '🇧🇿' },
  { code: '+502', country: 'GT', flag: '🇬🇹' },
  { code: '+503', country: 'SV', flag: '🇸🇻' },
  { code: '+504', country: 'HN', flag: '🇭🇳' },
  { code: '+505', country: 'NI', flag: '🇳🇮' },
  { code: '+506', country: 'CR', flag: '🇨🇷' },
  { code: '+507', country: 'PA', flag: '🇵🇦' },
  { code: '+508', country: 'PM', flag: '🇵🇲' },
  { code: '+509', country: 'HT', flag: '🇭🇹' },
  { code: '+590', country: 'GP', flag: '🇬🇵' },
  { code: '+591', country: 'BO', flag: '🇧🇴' },
  { code: '+592', country: 'GY', flag: '🇬🇾' },
  { code: '+593', country: 'EC', flag: '🇪🇨' },
  { code: '+594', country: 'GF', flag: '🇬🇫' },
  { code: '+595', country: 'PY', flag: '🇵🇾' },
  { code: '+596', country: 'MQ', flag: '🇲🇶' },
  { code: '+597', country: 'SR', flag: '🇸🇷' },
  { code: '+598', country: 'UY', flag: '🇺🇾' },
  { code: '+599', country: 'CW', flag: '🇨🇼' },
  { code: '+670', country: 'TL', flag: '🇹🇱' },
  { code: '+672', country: 'AQ', flag: '🇦🇶' },
  { code: '+673', country: 'BN', flag: '🇧🇳' },
  { code: '+674', country: 'NR', flag: '🇳🇷' },
  { code: '+675', country: 'PG', flag: '🇵🇬' },
  { code: '+676', country: 'TO', flag: '🇹🇴' },
  { code: '+677', country: 'SB', flag: '🇸🇧' },
  { code: '+678', country: 'VU', flag: '🇻🇺' },
  { code: '+679', country: 'FJ', flag: '🇫🇯' },
  { code: '+680', country: 'PW', flag: '🇵🇼' },
  { code: '+681', country: 'WF', flag: '🇼🇫' },
  { code: '+682', country: 'CK', flag: '🇨🇰' },
  { code: '+683', country: 'NU', flag: '🇳🇺' },
  { code: '+684', country: 'AS', flag: '🇦🇸' },
  { code: '+685', country: 'WS', flag: '🇼🇸' },
  { code: '+686', country: 'KI', flag: '🇰🇮' },
  { code: '+687', country: 'NC', flag: '🇳🇨' },
  { code: '+688', country: 'TV', flag: '🇹🇻' },
  { code: '+689', country: 'PF', flag: '🇵🇫' },
  { code: '+690', country: 'TK', flag: '🇹🇰' },
  { code: '+691', country: 'FM', flag: '🇫🇲' },
  { code: '+692', country: 'MH', flag: '🇲🇭' },
  { code: '+850', country: 'KP', flag: '🇰🇵' },
  { code: '+852', country: 'HK', flag: '🇭🇰' },
  { code: '+853', country: 'MO', flag: '🇲🇴' },
  { code: '+855', country: 'KH', flag: '🇰🇭' },
  { code: '+856', country: 'LA', flag: '🇱🇦' },
  { code: '+880', country: 'BD', flag: '🇧🇩' },
  { code: '+886', country: 'TW', flag: '🇹🇼' },
  { code: '+960', country: 'MV', flag: '🇲🇻' },
  { code: '+961', country: 'LB', flag: '🇱🇧' },
  { code: '+962', country: 'JO', flag: '🇯🇴' },
  { code: '+963', country: 'SY', flag: '🇸🇾' },
  { code: '+964', country: 'IQ', flag: '🇮🇶' },
  { code: '+965', country: 'KW', flag: '🇰🇼' },
  { code: '+966', country: 'SA', flag: '🇸🇦' },
  { code: '+967', country: 'YE', flag: '🇾🇪' },
  { code: '+968', country: 'OM', flag: '🇴🇲' },
  { code: '+970', country: 'PS', flag: '🇵🇸' },
  { code: '+971', country: 'AE', flag: '🇦🇪' },
  { code: '+972', country: 'IL', flag: '🇮🇱' },
  { code: '+973', country: 'BH', flag: '🇧🇭' },
  { code: '+974', country: 'QA', flag: '🇶🇦' },
  { code: '+975', country: 'BT', flag: '🇧🇹' },
  { code: '+976', country: 'MN', flag: '🇲🇳' },
  { code: '+977', country: 'NP', flag: '🇳🇵' },
  { code: '+992', country: 'TJ', flag: '🇹🇯' },
  { code: '+993', country: 'TM', flag: '🇹🇲' },
  { code: '+994', country: 'AZ', flag: '🇦🇿' },
  { code: '+995', country: 'GE', flag: '🇬🇪' },
  { code: '+996', country: 'KG', flag: '🇰🇬' },
  { code: '+998', country: 'UZ', flag: '🇺🇿' },
];

export function PhoneInput({ value, onChange, className, disabled }: PhoneInputProps) {
  // Parse the current value to separate country code and phone number
  const parsePhoneValue = (phoneValue: string) => {
    const found = countryCodes.find(cc => phoneValue.startsWith(cc.code));
    if (found) {
      return {
        countryCode: found.code,
        phoneNumber: phoneValue.slice(found.code.length)
      };
    }
    return {
      countryCode: '+234', // Default to Nigeria
      phoneNumber: phoneValue
    };
  };

  const { countryCode, phoneNumber } = parsePhoneValue(value);

  const handleCountryCodeChange = (newCode: string) => {
    onChange(newCode + phoneNumber);
  };

  const handlePhoneNumberChange = (newNumber: string) => {
    onChange(countryCode + newNumber);
  };

  return (
    <div className={cn("flex", className)}>
      <Select value={countryCode} onValueChange={handleCountryCodeChange} disabled={disabled}>
        <SelectTrigger className="w-24 rounded-r-none border-r-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {countryCodes.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              {country.flag} {country.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="tel"
        value={phoneNumber}
        onChange={(e) => handlePhoneNumberChange(e.target.value)}
        className="rounded-l-none"
        placeholder="Phone number"
        disabled={disabled}
      />
    </div>
  );
}