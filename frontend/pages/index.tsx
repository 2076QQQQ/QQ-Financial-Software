export async function getServerSideProps() {
  return { redirect: { destination: '/auth/LoginEntry', permanent: false } };
}

export default function Index() { return null; }