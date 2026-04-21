import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ListingForm from '@/components/brand/listing-form'

export default function NewListingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create a listing</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingForm listing={null} />
        </CardContent>
      </Card>
    </div>
  )
}
