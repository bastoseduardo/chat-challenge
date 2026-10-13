export default function ShareNotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-xl font-semibold">Compartilhamento inválido</h2>
        <p className="text-sm text-muted-foreground">
          O link está incorreto, foi revogado pelo autor ou expirou.
        </p>
      </div>
    </div>
  )
}
