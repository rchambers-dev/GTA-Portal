/** An employer the vacancy and candidate forms can offer. IDs are never typed. */
export type EmployerChoice = {
  employerId: string;
  name: string;
  site: string;
  address: string;
  contact: string;
  phone: string;
  email: string;
};

export const EXAMPLE_EMPLOYERS: EmployerChoice[] = [
  {
    employerId: "GTA-EMP-000014",
    name: "Northbridge Motors",
    site: "Doncaster",
    address: "Unit 4, Wheatley Hall Road, Doncaster",
    contact: "Diane Copeland, workshop manager",
    phone: "01302 555 014",
    email: "diane.copeland@northbridge-motors.example",
  },
  {
    employerId: "GTA-EMP-000021",
    name: "Ashfield Coachworks",
    site: "Sheffield",
    address: "Attercliffe, Sheffield",
    contact: "Workshop office",
    phone: "0114 555 021",
    email: "office@ashfield-coachworks.example",
  },
  {
    employerId: "GTA-EMP-000008",
    name: "Riverside Fleet Services",
    site: "Doncaster",
    address: "Lakeside, Doncaster",
    contact: "Fleet desk",
    phone: "01302 555 008",
    email: "fleet@riverside-fleet.example",
  },
  {
    employerId: "GTA-EMP-000033",
    name: "Hallam Street Garage",
    site: "Sheffield",
    address: "Walkley, Sheffield",
    contact: "Reception",
    phone: "0114 555 033",
    email: "hello@hallam-street.example",
  },
];
